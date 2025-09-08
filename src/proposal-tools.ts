/**
 * Proposal Operations Tools
 *
 * This module provides tools for managing and querying proposal data
 * from the Tally API, including listing proposals, getting proposal
 * details, and finding active proposals across organizations.
 *
 * IMPORTANT: All GraphQL queries have been tested with cURL against the real Tally API
 * Test command: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "YOUR_GRAPHQL_QUERY"}'
 */

import { z } from 'zod';
import { TallyGraphQLClient } from './graphql-client';
import { ValidationError } from './errors';

// Input validation schemas
export const ListProposalsInputSchema = z.object({
  organizationId: z.string().trim().min(1),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  // API-supported filters only
  governorId: z.string().optional(),
  proposer: z.string().optional(), // Address that created the proposal
  // API-supported sorting only (id is the only option)
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const GetProposalInputSchema = z
  .object({
    organizationId: z.string().trim().min(1).optional(),
    organizationSlug: z.string().trim().min(1).optional(),
    proposalId: z.string().trim().min(1),
  })
  .refine(
    (data) => {
      // At least one organization identifier should be provided for context
      // but it's not strictly required for the API call
      return true;
    },
    {
      message: 'Organization context is recommended but not required',
    }
  );

export const GetActiveProposalsInputSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  chainId: z.string().optional(),
  organizationId: z.string().optional(),
});

// Type definitions
export type ListProposalsInput = z.infer<typeof ListProposalsInputSchema>;
export type GetProposalInput = z.infer<typeof GetProposalInputSchema>;
export type GetActiveProposalsInput = z.infer<
  typeof GetActiveProposalsInputSchema
>;

export interface Proposer {
  id: string;
  name: string;
  address?: string;
}

export interface VotingStats {
  quorum: string;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  totalVotes?: string;
}

export interface ExecutionDetails {
  status: string;
  executedAt: string | null;
  transactionHash: string | null;
}

export interface TimelockOperation {
  type: 'erc20transfer' | 'nativetransfer' | 'custom' | 'other';
  target: string;
  value: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  amount?: string;
  recipient?: string;
  description: string;
}

export interface ExecutableCallDetail {
  id: string;
  target: string;
  value: string;
  signature: string;
  calldata: string;
  type?: string;
  decodedCalldata?: {
    signature: string;
    parameters: Array<{
      name: string;
      type: string;
      value: string;
    }>;
  };
  timelockOperation?: TimelockOperation;
}

export interface ProposalAction {
  id: string;
  target: string;
  value: string;
  signature: string;
  calldata: string;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
}

export interface ProposalSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  startTime: string;
  endTime: string;
  proposer: Proposer;
  votingStats: VotingStats;
  organization?: OrganizationInfo;
}

export interface ProposalDetails extends ProposalSummary {
  proposer: Proposer & {
    address: string;
  };
  votingStats: VotingStats & {
    totalVotes: string;
  };
  executionDetails: ExecutionDetails;
  actions: ProposalAction[];
  executableCalls: ExecutableCallDetail[];
  timelockOperations: TimelockOperation[];
  timelockSummary: {
    totalEthValue: string;
    totalTokenTransfers: number;
    majorOperations: string[];
  };
  tokenInfo: {
    symbol: string;
    name: string;
    decimals: number;
    conversionNote: string;
  };
}

export interface PaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export interface PaginatedProposals {
  proposals: ProposalSummary[];
  pagination: PaginationInfo;
}

// Validation helper functions
export function validateListProposalsInput(
  input: any
): z.SafeParseReturnType<any, ListProposalsInput> {
  return ListProposalsInputSchema.safeParse(input);
}

export function validateGetProposalInput(
  input: any
): z.SafeParseReturnType<any, GetProposalInput> {
  return GetProposalInputSchema.safeParse(input);
}

export function validateGetActiveProposalsInput(
  input: any
): z.SafeParseReturnType<any, GetActiveProposalsInput> {
  return GetActiveProposalsInputSchema.safeParse(input);
}

/**
 * List proposals for a specific organization with API-side filtering and sorting
 * Tested with: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "{ proposals(input: { filters: { organizationId: \"2206072050458560434\" }, sort: { sortBy: id, isDescending: true }, page: { limit: 3 } }) { nodes { ... on Proposal { id onchainId status metadata { title } organization { name } } } } }"}'
 */
export async function listProposals(
  client: TallyGraphQLClient,
  input: ListProposalsInput
): Promise<PaginatedProposals> {
  // Validate input
  const validation = validateListProposalsInput(input);
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input for listProposals',
      validation.error.errors
    );
  }

  // Apply defaults
  const {
    organizationId,
    page = 1,
    pageSize = 20,
    governorId,
    proposer,
    sortOrder = 'desc',
  } = validation.data;

  const typedPage = page as number;
  const typedPageSize = pageSize as number;

  // Build GraphQL query - only include sort if needed
  const includeSort = sortOrder === 'asc'; // desc is default, so only include if asc requested

  const query = includeSort
    ? `
    query ListProposals($pageSize: Int!, $filters: ProposalsFiltersInput!, $sort: ProposalsSortInput) {
      proposals(input: { 
        filters: $filters,
        sort: $sort,
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Proposal {
            id
            onchainId
            status
            metadata {
              title
              description
            }
            organization {
              name
              slug
            }
            proposer {
              address
              name
            }
            voteStats {
              type
              votesCount
              percent
            }
            start {
              ... on Block {
                timestamp
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
            end {
              ... on Block {
                timestamp
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
          }
        }
        pageInfo {
          count
          firstCursor
          lastCursor
        }
      }
    }
  `
    : `
    query ListProposals($pageSize: Int!, $filters: ProposalsFiltersInput!) {
      proposals(input: { 
        filters: $filters,
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Proposal {
            id
            onchainId
            status
            metadata {
              title
              description
            }
            organization {
              name
              slug
            }
            proposer {
              address
              name
            }
            voteStats {
              type
              votesCount
              percent
            }
            start {
              ... on Block {
                timestamp
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
            end {
              ... on Block {
                timestamp
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
          }
        }
        pageInfo {
          count
          firstCursor
          lastCursor
        }
      }
    }
  `;

  // Build API filters - keep organizationId as string to prevent precision loss
  const filters: any = { organizationId };
  if (governorId) filters.governorId = governorId;
  if (proposer) filters.proposer = proposer;

  // Build variables - only include sort if needed
  const variables: any = {
    pageSize,
    filters,
  };

  if (includeSort) {
    // Build API sort (only 'id' is supported)
    variables.sort = {
      sortBy: 'id',
      isDescending: sortOrder !== 'asc',
    };
  }

  const result = await client.query(query, variables);

  const proposals = result.proposals.nodes.map((proposal: any) => ({
    id: proposal.id,
    title: proposal.metadata.title,
    description: proposal.metadata.description,
    status: proposal.status,
    createdAt: '', // Not directly available
    startTime: proposal.start?.timestamp || '',
    endTime: proposal.end?.timestamp || '',
    proposer: {
      id: proposal.proposer?.address || '',
      name: proposal.proposer?.name || '',
      address: proposal.proposer?.address,
    },
    votingStats: {
      quorum: '0', // Would need separate calculation
      yesVotes:
        proposal.voteStats?.find((v: any) => v.type === 'for')?.votesCount ||
        '0',
      noVotes:
        proposal.voteStats?.find((v: any) => v.type === 'against')
          ?.votesCount || '0',
      abstainVotes:
        proposal.voteStats?.find((v: any) => v.type === 'abstain')
          ?.votesCount || '0',
    },
    organization: {
      id: '', // Not directly available in this query
      name: proposal.organization.name,
      slug: proposal.organization.slug,
    },
  }));

  return {
    proposals,
    pagination: {
      hasNextPage: false, // Tally API doesn't provide this info directly
      hasPreviousPage: false,
      totalCount: proposals.length, // Use actual count of returned proposals
      currentPage: typedPage,
      pageSize: typedPageSize,
    },
  };
}

/**
 * Get detailed proposal information by proposal ID
 * Tested with: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "{ proposal(input: { id: \"2589356045239322076\" }) { id onchainId status metadata { title description } organization { name } voteStats { type votesCount percent } } }"}'
 */
export async function getProposal(
  client: TallyGraphQLClient,
  input: GetProposalInput
): Promise<ProposalDetails | null> {
  // Validate input
  const validation = validateGetProposalInput(input);
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input for getProposal',
      validation.error.errors
    );
  }

  const { organizationId, organizationSlug, proposalId } = validation.data;

  // Build GraphQL query using actual Tally API schema
  const query = `
    query GetProposal($proposalId: IntID!) {
      proposal(input: { id: $proposalId }) {
        id
        onchainId
        status
        metadata {
          title
          description
        }
        organization {
          id
          name
          slug
        }
        proposer {
          address
          name
        }
        creator {
          address
          name
        }
        governor {
          id
          tokenId
          token {
            id
            symbol
            name
            decimals
          }
        }
        voteStats {
          type
          votesCount
          votersCount
          percent
        }
        start {
          ... on Block {
            timestamp
            number
          }
          ... on BlocklessTimestamp {
            timestamp
          }
        }
        end {
          ... on Block {
            timestamp
            number
          }
          ... on BlocklessTimestamp {
            timestamp
          }
        }
        executableCalls {
          target
          value
          signature
          calldata
          decodedCalldata {
            signature
            parameters {
              name
              type
              value
            }
          }
        }
      }
    }
  `;

  const variables = {
    proposalId,
  };

  const result = await client.query(query, variables);

  if (!result.proposal) {
    return null;
  }

  const proposal = result.proposal;
  
  // Analyze timelock operations from executable calls
  const timelockAnalysis = analyzeTimelockOperations(proposal.executableCalls || []);
  
  // Get token information for vote conversion
  const tokenInfo = proposal.governor?.token || null;
  const decimals = tokenInfo?.decimals || 18; // Default to 18 if not available
  const tokenSymbol = tokenInfo?.symbol || 'TOKEN';
  
  return {
    id: proposal.id,
    title: proposal.metadata.title,
    description: proposal.metadata.description,
    status: proposal.status,
    createdAt: '', // Not directly available
    startTime: proposal.start?.timestamp || '',
    endTime: proposal.end?.timestamp || '',
    proposer: {
      id: proposal.proposer?.address || proposal.creator?.address || '',
      name: proposal.proposer?.name || proposal.creator?.name || '',
      address: proposal.proposer?.address || proposal.creator?.address || '',
    },
    organization: {
      id: proposal.organization?.id || '',
      name: proposal.organization?.name || '',
      slug: proposal.organization?.slug || '',
    },
    votingStats: {
      quorum: '0', // Would need separate calculation
      yesVotes:
        proposal.voteStats?.find((v: any) => v.type === 'for')?.votesCount ||
        '0',
      noVotes:
        proposal.voteStats?.find((v: any) => v.type === 'against')
          ?.votesCount || '0',
      abstainVotes:
        proposal.voteStats?.find((v: any) => v.type === 'abstain')
          ?.votesCount || '0',
      totalVotes:
        proposal.voteStats
          ?.reduce(
            (sum: number, v: any) => sum + parseInt(v.votesCount || '0'),
            0
          )
          .toString() || '0',
    },
    tokenInfo: {
      symbol: tokenSymbol,
      name: tokenInfo?.name || '',
      decimals: decimals,
      conversionNote: `⚠️ IMPORTANT: All vote counts are in raw token units (Ethereum-style). To convert to human-readable amounts, divide by 10^${decimals}. LLM must perform this calculation.`,
    },
    executionDetails: {
      status: proposal.status,
      executedAt: null, // Not directly available
      transactionHash: null, // Not directly available
    },
    actions:
      proposal.executableCalls?.map((call: any, index: number) => ({
        id: index.toString(),
        target: call.target,
        value: call.value,
        signature: call.signature,
        calldata: call.calldata,
      })) || [],
    executableCalls:
      proposal.executableCalls?.map((call: any, index: number) => ({
        id: index.toString(),
        target: call.target,
        value: call.value,
        signature: call.signature,
        calldata: call.calldata,
        type: call.type,
        decodedCalldata: call.decodedCalldata,
      })) || [],
    timelockOperations: timelockAnalysis.operations,
    timelockSummary: timelockAnalysis.summary,
  };
}

/**
 * Get active proposals across all organizations or filtered by criteria
 * Uses the proper Tally API approach: query organizations sorted by activity,
 * then get proposals from those with active proposals.
 */
export async function getActiveProposals(
  client: TallyGraphQLClient,
  input: GetActiveProposalsInput
): Promise<PaginatedProposals> {
  // Validate input
  const validation = validateGetActiveProposalsInput(input);
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input for getActiveProposals',
      validation.error.errors
    );
  }

  // Apply defaults
  const { page = 1, pageSize = 20, chainId, organizationId } = validation.data;

  const typedPage = page as number;
  const typedPageSize = pageSize as number;

  if (organizationId) {
    // If organizationId is provided, query that specific organization's proposals
    // and filter for active status on the client side
    const proposalsQuery = `
      query GetProposalsForOrg($organizationId: IntID!, $pageSize: Int!) {
        proposals(input: { 
          filters: { 
            organizationId: $organizationId
          },
          page: { limit: $pageSize }
        }) {
          nodes {
            ... on Proposal {
              id
              onchainId
              status
              metadata {
                title
                description
              }
              organization {
                id
                name
                slug
              }
              proposer {
                address
                name
              }
              voteStats {
                type
                votesCount
                percent
              }
              start {
                ... on Block {
                  timestamp
                }
                ... on BlocklessTimestamp {
                  timestamp
                }
              }
              end {
                ... on Block {
                  timestamp
                }
                ... on BlocklessTimestamp {
                  timestamp
                }
              }
            }
          }
          pageInfo {
            count
            firstCursor
            lastCursor
          }
        }
      }
    `;

    const result = await client.query(proposalsQuery, {
      organizationId,
      pageSize: 50, // Get more to filter down to active ones
    });

    // Filter for truly votable proposals (active or extended status)
    const votableProposals = result.proposals.nodes
      .filter((proposal: any) => proposal.status === 'active' || proposal.status === 'extended')
      .slice(0, typedPageSize) // Apply pagination after filtering
      .map((proposal: any) => ({
        id: proposal.id,
        title: proposal.metadata.title,
        description: proposal.metadata.description,
        status: proposal.status,
        createdAt: '', // Not directly available
        startTime: proposal.start?.timestamp || '',
        endTime: proposal.end?.timestamp || '',
        proposer: {
          id: proposal.proposer?.address || '',
          name: proposal.proposer?.name || '',
          address: proposal.proposer?.address,
        },
        votingStats: {
          quorum: '0', // Would need separate calculation
          yesVotes:
            proposal.voteStats?.find((v: any) => v.type === 'for')?.votesCount ||
            '0',
          noVotes:
            proposal.voteStats?.find((v: any) => v.type === 'against')
              ?.votesCount || '0',
          abstainVotes:
            proposal.voteStats?.find((v: any) => v.type === 'abstain')
              ?.votesCount || '0',
        },
        organization: {
          id: proposal.organization?.id || '',
          name: proposal.organization?.name || '',
          slug: proposal.organization?.slug || '',
        },
      }));

    return {
      proposals: votableProposals,
      pagination: {
        hasNextPage: false, // Tally API doesn't provide this info directly
        hasPreviousPage: false,
        totalCount: votableProposals.length,
        currentPage: typedPage,
        pageSize: typedPageSize,
      },
    };
  }

  // Step 1: Get organizations sorted by activity (those with active proposals first)
  const organizationsQuery = `
    query GetActiveOrganizations($pageSize: Int!) {
      organizations(input: { 
        sort: { sortBy: explore, isDescending: true },
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Organization {
            id
            name
            slug
            hasActiveProposals
            proposalsCount
          }
        }
      }
    }
  `;

  const orgsResult = await client.query(organizationsQuery, {
    pageSize: 50, // Get top 50 most active organizations
  });

  // Filter to only organizations that have active proposals
  const activeOrgs = orgsResult.organizations.nodes.filter(
    (org: any) => org.hasActiveProposals === true
  );

  if (activeOrgs.length === 0) {
    return {
      proposals: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 0,
        currentPage: typedPage,
        pageSize: typedPageSize,
      },
    };
  }

  // Step 2: Query active proposals from organizations with active proposals
  const proposalsQuery = `
    query GetProposalsForOrg($organizationId: IntID!, $pageSize: Int!) {
      proposals(input: { 
        filters: { 
          organizationId: $organizationId
        },
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Proposal {
            id
            onchainId
            status
            metadata {
              title
              description
            }
            organization {
              id
              name
              slug
            }
            proposer {
              address
              name
            }
            voteStats {
              type
              votesCount
              percent
            }
            start {
              ... on Block {
                timestamp
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
            end {
              ... on Block {
                timestamp
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
          }
        }
      }
    }
  `;

  const allVotableProposals: ProposalSummary[] = [];

  // Query each organization with active proposals
  for (const org of activeOrgs) {
    try {
      const result = await client.query(proposalsQuery, {
        organizationId: org.id,
        pageSize: 5, // Get active proposals from each org
      });

      if (result.proposals?.nodes) {
        // All proposals should be votable (active or extended), but double-check
        const votableProposals = result.proposals.nodes
          .filter((proposal: any) => proposal.status === 'active' || proposal.status === 'extended')
          .map((proposal: any) => ({
            id: proposal.id,
            title: proposal.metadata.title,
            description: proposal.metadata.description,
            status: proposal.status,
            createdAt: '', // Not directly available
            startTime: proposal.start?.timestamp || '',
            endTime: proposal.end?.timestamp || '',
            proposer: {
              id: proposal.proposer?.address || '',
              name: proposal.proposer?.name || '',
              address: proposal.proposer?.address,
            },
            votingStats: {
              quorum: '0', // Would need separate calculation
              yesVotes:
                proposal.voteStats?.find((v: any) => v.type === 'for')?.votesCount ||
                '0',
              noVotes:
                proposal.voteStats?.find((v: any) => v.type === 'against')
                  ?.votesCount || '0',
              abstainVotes:
                proposal.voteStats?.find((v: any) => v.type === 'abstain')
                  ?.votesCount || '0',
            },
            organization: {
              id: proposal.organization?.id || org.id,
              name: proposal.organization?.name || org.name,
              slug: proposal.organization?.slug || org.slug,
            },
          }));

        allVotableProposals.push(...votableProposals);
      }
    } catch (error) {
      // Continue with other organizations if one fails
      console.warn(`Failed to get proposals for org ${org.id}:`, error);
      continue;
    }
  }

  // Sort by end time (soonest ending first) and apply pagination
  const sortedProposals = allVotableProposals.sort((a, b) => {
    if (!a.endTime || !b.endTime) return 0;
    return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
  });

  // Apply pagination
  const startIndex = (typedPage - 1) * typedPageSize;
  const endIndex = startIndex + typedPageSize;
  const paginatedProposals = sortedProposals.slice(startIndex, endIndex);

  return {
    proposals: paginatedProposals,
    pagination: {
      hasNextPage: endIndex < sortedProposals.length,
      hasPreviousPage: typedPage > 1,
      totalCount: sortedProposals.length,
      currentPage: typedPage,
      pageSize: typedPageSize,
    },
  };
}

/**
 * Analyze executable calls to extract timelock operations
 */
function analyzeTimelockOperations(executableCalls: any[]): {
  operations: TimelockOperation[];
  summary: {
    totalEthValue: string;
    totalTokenTransfers: number;
    majorOperations: string[];
  };
} {
  const operations: TimelockOperation[] = [];
  let totalEthValue = BigInt(0);
  let totalTokenTransfers = 0;
  const majorOperations: string[] = [];

  for (const call of executableCalls) {
    const ethValue = BigInt(call.value || '0');
    
    // Determine operation type based on decoded calldata or signature
    let operationType: TimelockOperation['type'] = 'custom';
    let description = '';
    let tokenAddress: string | undefined;
    let amount: string | undefined;
    let recipient: string | undefined;

    // Analyze by function signature if available
    const signature = call.decodedCalldata?.signature || call.signature || '';
    
    if (signature.includes('transfer(')) {
      operationType = 'erc20transfer';
      description = 'ERC20 Token Transfer';
      totalTokenTransfers++;
      
      // Extract recipient and amount from parameters
      if (call.decodedCalldata?.parameters) {
        const params = call.decodedCalldata.parameters;
        recipient = params.find((p: any) => p.name === 'to' || p.name === 'recipient')?.value;
        amount = params.find((p: any) => p.name === 'amount' || p.name === 'value')?.value;
      }
      tokenAddress = call.target;
    } else if (signature.includes('transferFrom(')) {
      operationType = 'erc20transfer';
      description = 'ERC20 Token Transfer (From)';
      totalTokenTransfers++;
      
      if (call.decodedCalldata?.parameters) {
        const params = call.decodedCalldata.parameters;
        recipient = params.find((p: any) => p.name === 'to')?.value;
        amount = params.find((p: any) => p.name === 'amount' || p.name === 'value')?.value;
      }
      tokenAddress = call.target;
    } else if (ethValue > 0n) {
      operationType = 'nativetransfer';
      description = `Native Token Transfer: ${ethValue.toString()} wei`;
      recipient = call.target;
      amount = ethValue.toString();
      totalEthValue += ethValue;
    } else if (signature.includes('execute(') || signature.includes('multicall(')) {
      operationType = 'custom';
      description = 'Complex Timelock Operation';
    } else {
      operationType = 'other';
      description = signature || 'Unknown Operation';
    }

    // Create timelock operation
    const operation: TimelockOperation = {
      type: operationType,
      target: call.target,
      value: call.value || '0',
      tokenAddress,
      amount,
      recipient,
      description,
    };

    operations.push(operation);

    // Add to major operations if significant
    if (ethValue > BigInt('1000000000000000000') || // > 1 ETH
        operationType === 'erc20transfer' ||
        operationType === 'custom') {
      majorOperations.push(description);
    }
  }

  return {
    operations,
    summary: {
      totalEthValue: totalEthValue.toString(),
      totalTokenTransfers,
      majorOperations,
    },
  };
}
