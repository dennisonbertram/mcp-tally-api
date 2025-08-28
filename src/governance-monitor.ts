/**
 * Governance Monitor - Tracks and notifies about governance events
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TallyGraphQLClient } from './graphql-client.js';

interface ProposalStatus {
  id: string;
  organizationId: string;
  status: string;
  lastChecked: Date;
}

interface DelegateActivity {
  address: string;
  organizationId: string;
  lastVoteTime: Date;
  lastProposalId: string;
}

interface DAOMembership {
  organizationId: string;
  memberCount: number;
  lastChecked: Date;
}

export class GovernanceMonitor {
  private proposalStatuses = new Map<string, ProposalStatus>();
  private delegateActivities = new Map<string, DelegateActivity>();
  private daoMemberships = new Map<string, DAOMembership>();
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private isMonitoring = false;
  private server: McpServer | null = null;
  private graphqlClient: TallyGraphQLClient;

  constructor(graphqlClient: TallyGraphQLClient) {
    this.graphqlClient = graphqlClient;
  }

  /**
   * Set the MCP server instance for sending notifications
   */
  setServer(server: McpServer) {
    this.server = server;
  }

  /**
   * Start monitoring governance events
   */
  startMonitoring(organizationIds?: string[]) {
    if (this.isMonitoring) {
      return;
    }
    this.isMonitoring = true;

    // Start monitoring proposals
    this.startProposalMonitoring(organizationIds);
    
    // Start monitoring delegate activity
    this.startDelegateMonitoring(organizationIds);
    
    // Start monitoring DAO membership
    this.startMembershipMonitoring(organizationIds);
  }

  /**
   * Stop monitoring governance events
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    // Clear all intervals
    for (const [key, interval] of this.monitoringIntervals.entries()) {
      clearInterval(interval);
      this.monitoringIntervals.delete(key);
    }
    
    // Clear cached data
    this.proposalStatuses.clear();
    this.delegateActivities.clear();
    this.daoMemberships.clear();
  }

  /**
   * Monitor proposal status changes
   */
  private startProposalMonitoring(organizationIds?: string[]) {
    const checkProposals = async () => {
      if (!this.isMonitoring) return;

      try {
        // Query active proposals
        const query = `
          query GetActiveProposals($organizationIds: [String!]) {
            proposals(
              input: {
                filters: {
                  organizationIds: $organizationIds
                  includeArchived: false
                  isDraft: false
                }
                page: { limit: 100 }
              }
            ) {
              nodes {
                id
                status
                organization {
                  id
                }
              }
            }
          }
        `;

        const variables = organizationIds ? { organizationIds } : {};
        const result = await this.graphqlClient.query(query, variables);

        if (result?.proposals?.nodes) {
          for (const proposal of result.proposals.nodes) {
            const key = `${proposal.organization.id}:${proposal.id}`;
            const existing = this.proposalStatuses.get(key);

            if (existing && existing.status !== proposal.status) {
              // Status changed - send notification
              await this.sendProposalStatusNotification(
                proposal.id,
                proposal.organization.id,
                existing.status,
                proposal.status
              );
            }

            // Update or add the proposal status
            this.proposalStatuses.set(key, {
              id: proposal.id,
              organizationId: proposal.organization.id,
              status: proposal.status,
              lastChecked: new Date(),
            });
          }
        }
      } catch (error) {
        console.error('Error monitoring proposals:', error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkProposals, 30000);
    this.monitoringIntervals.set('proposals', interval);
    
    // Run initial check
    checkProposals();
  }

  /**
   * Monitor delegate voting activity
   */
  private startDelegateMonitoring(organizationIds?: string[]) {
    const checkDelegates = async () => {
      if (!this.isMonitoring) return;

      try {
        // Query recent votes
        const query = `
          query GetRecentVotes($organizationIds: [String!]) {
            votes(
              input: {
                filters: {
                  organizationIds: $organizationIds
                }
                page: { limit: 50 }
                sort: {
                  field: CREATED_AT
                  order: DESC
                }
              }
            ) {
              nodes {
                voter {
                  address
                }
                proposal {
                  id
                  organization {
                    id
                  }
                }
                support
                weight
                timestamp
              }
            }
          }
        `;

        const variables = organizationIds ? { organizationIds } : {};
        const result = await this.graphqlClient.query(query, variables);

        if (result?.votes?.nodes) {
          for (const vote of result.votes.nodes) {
            const key = `${vote.voter.address}:${vote.proposal.organization.id}`;
            const existing = this.delegateActivities.get(key);

            if (!existing || existing.lastProposalId !== vote.proposal.id) {
              // New vote detected - send notification
              await this.sendDelegateVotingNotification(
                vote.voter.address,
                vote.proposal.id,
                vote.proposal.organization.id,
                vote.support,
                vote.weight
              );

              // Update delegate activity
              this.delegateActivities.set(key, {
                address: vote.voter.address,
                organizationId: vote.proposal.organization.id,
                lastVoteTime: new Date(vote.timestamp),
                lastProposalId: vote.proposal.id,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error monitoring delegate activity:', error);
      }
    };

    // Check every minute
    const interval = setInterval(checkDelegates, 60000);
    this.monitoringIntervals.set('delegates', interval);
    
    // Run initial check
    checkDelegates();
  }

  /**
   * Monitor DAO membership changes
   */
  private startMembershipMonitoring(organizationIds?: string[]) {
    const checkMembership = async () => {
      if (!this.isMonitoring) return;

      try {
        // Query organization member counts
        const query = `
          query GetOrganizationMembers($ids: [String!]) {
            organizations(
              input: {
                filters: {
                  ids: $ids
                }
              }
            ) {
              nodes {
                id
                membersCount
              }
            }
          }
        `;

        const variables = organizationIds ? { ids: organizationIds } : {};
        const result = await this.graphqlClient.query(query, variables);

        if (result?.organizations?.nodes) {
          for (const org of result.organizations.nodes) {
            const existing = this.daoMemberships.get(org.id);

            if (existing && existing.memberCount !== org.membersCount) {
              // Membership changed - send notification
              await this.sendMembershipChangeNotification(
                org.id,
                existing.memberCount,
                org.membersCount
              );
            }

            // Update membership count
            this.daoMemberships.set(org.id, {
              organizationId: org.id,
              memberCount: org.membersCount,
              lastChecked: new Date(),
            });
          }
        }
      } catch (error) {
        console.error('Error monitoring membership:', error);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkMembership, 300000);
    this.monitoringIntervals.set('membership', interval);
    
    // Run initial check
    checkMembership();
  }

  /**
   * Send notification for proposal status change
   */
  private async sendProposalStatusNotification(
    proposalId: string,
    organizationId: string,
    oldStatus: string,
    newStatus: string
  ) {
    if (!this.server) return;

    try {
      await this.server.notification({
        method: 'notifications/proposal/status_changed',
        params: {
          proposalId,
          organizationId,
          oldStatus,
          newStatus,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error sending proposal status notification:', error);
    }
  }

  /**
   * Send notification for delegate voting activity
   */
  private async sendDelegateVotingNotification(
    delegateAddress: string,
    proposalId: string,
    organizationId: string,
    vote: string,
    votingPower: string
  ) {
    if (!this.server) return;

    try {
      await this.server.notification({
        method: 'notifications/delegate/voted',
        params: {
          delegateAddress,
          proposalId,
          organizationId,
          vote,
          votingPower,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error sending delegate voting notification:', error);
    }
  }

  /**
   * Send notification for DAO membership change
   */
  private async sendMembershipChangeNotification(
    organizationId: string,
    previousMemberCount: number,
    newMemberCount: number
  ) {
    if (!this.server) return;

    try {
      await this.server.notification({
        method: 'notifications/dao/membership_changed',
        params: {
          organizationId,
          previousMemberCount,
          newMemberCount,
          change: newMemberCount > previousMemberCount ? 'increase' : 'decrease',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error sending membership change notification:', error);
    }
  }

  /**
   * Manually trigger a notification for testing
   */
  async sendTestNotification(type: 'proposal' | 'delegate' | 'membership') {
    if (!this.server) return;

    switch (type) {
      case 'proposal':
        await this.sendProposalStatusNotification(
          'test-proposal-123',
          'test-org-456',
          'active',
          'passed'
        );
        break;
      case 'delegate':
        await this.sendDelegateVotingNotification(
          '0xtest123',
          'test-proposal-789',
          'test-org-456',
          'yes',
          '1000000000000000000'
        );
        break;
      case 'membership':
        await this.sendMembershipChangeNotification(
          'test-org-456',
          100,
          101
        );
        break;
    }
  }
}