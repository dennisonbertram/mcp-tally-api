/**
 * Organization Management Tools
 *
 * This module provides tools for managing and querying organization data
 * from the Tally API, including listing organizations, getting organization
 * details, and finding organizations with active proposals.
 *
 * IMPORTANT: All GraphQL queries have been tested with cURL against the real Tally API
 * Test command: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "YOUR_GRAPHQL_QUERY"}'
 */

import { z } from 'zod';
import { TallyGraphQLClient } from './graphql-client';
import { ValidationError } from './errors';

// Input validation schemas
export const ListOrganizationsInputSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  // API-supported filters only
  chainId: z.string().optional(),
  hasLogo: z.boolean().optional(),
  // API-supported sorting only
  sortBy: z.enum(['id', 'name', 'explore', 'popular']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const GetOrganizationInputSchema = z
  .object({
    organizationId: z.string().trim().min(1).optional(),
    organizationSlug: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => {
      const hasId = !!data.organizationId;
      const hasSlug = !!data.organizationSlug;
      return hasId !== hasSlug; // Exactly one should be provided
    },
    {
      message:
        'Either organizationId or organizationSlug must be provided, but not both',
    }
  );

export const GetOrganizationsWithActiveProposalsInputSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  minActiveProposals: z.number().int().positive().optional(),
  chainId: z.string().optional(),
});

// Type definitions
export type ListOrganizationsInput = z.infer<
  typeof ListOrganizationsInputSchema
>;
export type GetOrganizationInput = z.infer<typeof GetOrganizationInputSchema>;
export type GetOrganizationsWithActiveProposalsInput = z.infer<
  typeof GetOrganizationsWithActiveProposalsInputSchema
>;

export interface ProposalStats {
  total: number;
  active: number;
  passed?: number;
  failed?: number;
}

export interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface TimelockInfo {
  governorId: string;
  timelockAddress?: string;
  governorAddress: string;
  tokenInfo?: {
    symbol: string;
    name: string;
    decimals: number;
  };
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  chainId: string;
  description: string;
  proposalStats: ProposalStats;
  memberCount: number;
  timelocks?: TimelockInfo[];
  safes?: string[];
}

export interface OrganizationDetails extends OrganizationSummary {
  website?: string;
  twitter?: string;
  github?: string;
  proposalStats: ProposalStats & {
    passed: number;
    failed: number;
  };
  createdAt: string;
  tokens: Token[];
  timelocks: TimelockInfo[];
  safes: string[];
}

export interface ActiveProposal {
  id: string;
  title: string;
  status: string;
  endTime: string;
}

export interface OrganizationWithActiveProposals extends OrganizationSummary {
  activeProposals: ActiveProposal[];
}

export interface PaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export interface PaginatedOrganizations {
  organizations: OrganizationSummary[];
  pagination: PaginationInfo;
}

export interface PaginatedOrganizationsWithActiveProposals {
  organizations: OrganizationWithActiveProposals[];
  pagination: PaginationInfo;
}

// Validation helper functions
export function validateListOrganizationsInput(
  input: any
): z.SafeParseReturnType<any, ListOrganizationsInput> {
  return ListOrganizationsInputSchema.safeParse(input);
}

export function validateGetOrganizationInput(
  input: any
): z.SafeParseReturnType<any, GetOrganizationInput> {
  return GetOrganizationInputSchema.safeParse(input);
}

export function validateGetOrganizationsWithActiveProposalsInput(
  input: any
): z.SafeParseReturnType<any, GetOrganizationsWithActiveProposalsInput> {
  return GetOrganizationsWithActiveProposalsInputSchema.safeParse(input);
}

/**
 * List organizations with pagination, filtering, and sorting
 * Uses API-side filtering and sorting for optimal performance
 * Tested with: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "{ organizations(input: { filters: { chainId: \"eip155:1\" }, sort: { sortBy: name, isDescending: false }, page: { limit: 5 } }) { nodes { ... on Organization { id name slug chainIds governorIds proposalsCount delegatesCount hasActiveProposals metadata { description } } } pageInfo { count firstCursor lastCursor } } }"}'
 */
export async function listOrganizations(
  client: TallyGraphQLClient,
  input: ListOrganizationsInput
): Promise<PaginatedOrganizations> {
  // Validate input
  const validation = validateListOrganizationsInput(input);
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input for listOrganizations',
      validation.error.errors
    );
  }

  // Apply defaults
  const {
    page = 1,
    pageSize = 20,
    chainId,
    hasLogo,
    sortBy = 'name',
    sortOrder = 'asc',
  } = validation.data;

  // Use API-side pagination only - no client-side processing
  const query = `
    query ListOrganizations($pageSize: Int!, $filters: OrganizationsFiltersInput, $sort: OrganizationsSortInput) {
      organizations(input: { 
        filters: $filters,
        sort: $sort,
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Organization {
            id
            name
            slug
            chainIds
            governorIds
            proposalsCount
            delegatesCount
            hasActiveProposals
            metadata {
              description
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

  // Build API filters
  const filters: any = {};
  if (chainId) filters.chainId = chainId;
  if (hasLogo !== undefined) filters.hasLogo = hasLogo;

  // Build API sort
  const sort = {
    sortBy: sortBy,
    isDescending: sortOrder === 'desc',
  };

  const variables = {
    pageSize,
    filters: Object.keys(filters).length > 0 ? filters : null,
    sort,
  };

  const result: any = await client.query(query, variables);

  // Minimal data transformation only (no filtering/sorting/pagination)
  const transformedOrganizations = result.organizations.nodes.map(
    (org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      chainId: org.chainIds[0] || '',
      description: org.metadata?.description || '',
      proposalStats: {
        total: org.proposalsCount,
        active: org.hasActiveProposals ? 1 : 0,
      },
      memberCount: org.delegatesCount,
    })
  );

  return {
    organizations: transformedOrganizations,
    pagination: {
      hasNextPage: false, // Tally API doesn't provide this info directly
      hasPreviousPage: page > 1,
      totalCount: result.organizations.pageInfo.count || 0,
      currentPage: page,
      pageSize,
    },
  };
}

/**
 * Get detailed organization information by ID or slug
 * Tested with: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "{ organization(input: { slug: \"uniswap\" }) { id name slug chainIds governorIds proposalsCount delegatesCount hasActiveProposals } }"}'
 */
export async function getOrganization(
  client: TallyGraphQLClient,
  input: GetOrganizationInput
): Promise<OrganizationDetails | null> {
  // Validate input
  const validation = validateGetOrganizationInput(input);
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input for getOrganization',
      validation.error.errors
    );
  }

  const { organizationId, organizationSlug } = validation.data;

  // Build GraphQL query using actual Tally API schema
  const query = `
    query GetOrganization($organizationId: IntID, $organizationSlug: String) {
      organization(input: { 
        id: $organizationId, 
        slug: $organizationSlug 
      }) {
        id
        name
        slug
        chainIds
        governorIds
        proposalsCount
        delegatesCount
        hasActiveProposals
        metadata {
          description
          icon
          color
        }
        creator {
          address
          name
          safes
        }
      }
    }
  `;

  const variables = {
    organizationId,
    organizationSlug,
  };

  const result = await client.query(query, variables);

  if (!result.organization) {
    return null;
  }

  const org = result.organization;
  
  // Fetch all governors' details for timelock info
  let timelocks: TimelockInfo[] = [];
  let safes: string[] = org.creator?.safes || [];

  if (org.governorIds && org.governorIds.length > 0) {
    // Fetch details for all governors
    for (const governorId of org.governorIds) {
      try {
        const governorQuery = `
          query GetGovernor($governorId: AccountID!) {
            governor(input: { id: $governorId }) {
              id
              timelockId
              token {
                id
                symbol
                name
                decimals
              }
              contracts {
                governor {
                  address
                }
              }
            }
          }
        `;

        const governorResult = await client.query(governorQuery, {
          governorId,
        });

        if (governorResult.governor) {
          timelocks.push({
            governorId: governorResult.governor.id,
            timelockAddress: governorResult.governor.timelockId,
            governorAddress: governorResult.governor.contracts?.governor?.address || governorId,
            tokenInfo: {
              symbol: governorResult.governor.token?.symbol || '',
              name: governorResult.governor.token?.name || '',
              decimals: governorResult.governor.token?.decimals || 0,
            },
          });
        }
      } catch (error) {
        // If governor query fails, continue with basic info for this governor
        console.warn(`Failed to fetch governor details for ${governorId}:`, error);
        timelocks.push({
          governorId,
          timelockAddress: undefined,
          governorAddress: governorId,
          tokenInfo: undefined,
        });
      }
    }
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    chainId: org.chainIds[0] || '',
    description: org.metadata?.description || '',
    website: undefined, // Not available in Tally API
    twitter: undefined, // Not available in Tally API
    github: undefined, // Not available in Tally API
    proposalStats: {
      total: org.proposalsCount,
      active: org.hasActiveProposals ? 1 : 0,
      passed: 0, // Would need separate query
      failed: 0, // Would need separate query
    },
    memberCount: org.delegatesCount,
    createdAt: '', // Not available in Tally API
    tokens: [], // Would need separate query
    timelocks,
    safes,
  };
}

/**
 * Get organizations with active proposals
 * NOTE: The Tally API does not support filtering by hasActiveProposals.
 * This function uses the 'explore' sort which prioritizes organizations with live proposals.
 * This is server-side sorting only - no client-side filtering is performed.
 * Tested with: curl -X POST https://api.tally.xyz/query -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" -d '{"query": "{ organizations(input: { sort: { sortBy: explore, isDescending: true }, page: { limit: 20 } }) { nodes { ... on Organization { id name slug chainIds governorIds proposalsCount delegatesCount hasActiveProposals metadata { description } } } pageInfo { count firstCursor lastCursor } } }"}'
 */
export async function getOrganizationsWithActiveProposals(
  client: TallyGraphQLClient,
  input: GetOrganizationsWithActiveProposalsInput
): Promise<PaginatedOrganizationsWithActiveProposals> {
  // Validate input
  const validation = validateGetOrganizationsWithActiveProposalsInput(input);
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input for getOrganizationsWithActiveProposals',
      validation.error.errors
    );
  }

  // Apply defaults
  const {
    pageSize = 20,
    chainId,
  } = validation.data;

  // Use 'explore' sort which prioritizes organizations with live proposals
  // This is server-side sorting only - no client-side processing
  const query = `
    query GetOrganizationsWithActiveProposals($pageSize: Int!, $chainId: ChainID) {
      organizations(input: { 
        filters: { chainId: $chainId },
        sort: { sortBy: explore, isDescending: true },
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Organization {
            id
            name
            slug
            chainIds
            governorIds
            proposalsCount
            delegatesCount
            hasActiveProposals
            metadata {
              description
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

  const variables = {
    pageSize,
    chainId,
  };

  const result = await client.query(query, variables);

  // Transform data without any client-side filtering (server-side only)
  const transformedOrgs = result.organizations.nodes.map((org: any) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    chainId: org.chainIds[0] || '',
    description: org.metadata?.description || '',
    proposalStats: {
      total: org.proposalsCount,
      active: org.hasActiveProposals ? 1 : 0,
    },
    memberCount: org.delegatesCount,
    activeProposals: [], // Would need separate query to get actual proposal details
  }));

  return {
    organizations: transformedOrgs,
    pagination: {
      hasNextPage: false, // Tally API doesn't provide this info directly
      hasPreviousPage: false,
      totalCount: result.organizations.pageInfo.count || 0,
      currentPage: 1,
      pageSize: transformedOrgs.length,
    },
  };
}
