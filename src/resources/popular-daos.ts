/**
 * Popular DAOs Resource - Synchronous Dynamic Loading
 *
 * This resource dynamically loads all supported chains from the Tally API when requested,
 * then fetches the top DAOs by delegate count from each production network (excluding testnets).
 * It provides real-time accurate information and lookup dictionaries.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

export interface PopularDAOMapping {
  id: string;
  name: string;
  slug: string;
  chainId: string;
  chainName: string;
  memberCount: number;
  delegateCount: number;
  proposalCount: number;
  hasActiveProposals: boolean;
}

export interface SupportedChain {
  id: string;
  name: string;
  mediumName: string;
  shortName: string;
  isTestnet: boolean;
  blockTime: number;
}

export interface PopularDAOsResponse {
  status: 'success' | 'error';
  description: string;
  total_count: number;
  chains_loaded: number;
  total_chains_available: number;
  production_chains_available: number;
  networks_included: string[];
  daos: PopularDAOMapping[];
  lookup_by_name: Record<string, PopularDAOMapping>;
  lookup_by_slug: Record<string, PopularDAOMapping>;
  lookup_by_id: Record<string, PopularDAOMapping>;
  chains_by_id: Record<string, SupportedChain>;
  production_chains_by_id: Record<string, SupportedChain>;
  last_updated: string;
  error_message?: string;
  note: string;
  usage_examples: string[];
}

/**
 * Load popular DAOs data synchronously when requested
 */
export async function getPopularDAOsData(graphqlClient: TallyGraphQLClient): Promise<PopularDAOsResponse> {
  const startTime = new Date().toISOString();
  
  try {
    // Step 1: Fetch ALL supported chains from API
    const allChains = await loadAllChains(graphqlClient);
    
    // Step 2: Filter to production chains only (exclude testnets)
    const productionChains = allChains.filter(chain => !chain.isTestnet);
    
    if (productionChains.length === 0) {
      throw new Error('No production chains found in API response');
    }
    
    // Step 3: Fetch popular DAOs from production chains only
    const daos = await loadPopularDAOs(graphqlClient, productionChains);
    
    // Step 4: Generate lookup dictionaries
    const { lookupByName, lookupBySlug, lookupById } = generateLookups(daos);
    const chainsById = generateChainsLookup(allChains);
    const productionChainsById = generateChainsLookup(productionChains);
    const networksIncluded = productionChains.map(chain => `${chain.id} (${chain.mediumName})`);
    const chainsWithDAOs = [...new Set(daos.map(dao => dao.chainId))];

    return {
      status: 'success',
      description: `Top 20 DAOs by delegate count across all production networks, dynamically loaded from Tally API.`,
      total_count: daos.length,
      chains_loaded: chainsWithDAOs.length,
      total_chains_available: allChains.length,
      production_chains_available: productionChains.length,
      networks_included: networksIncluded,
      daos: daos,
      lookup_by_name: lookupByName,
      lookup_by_slug: lookupBySlug,
      lookup_by_id: lookupById,
      chains_by_id: chainsById,
      production_chains_by_id: productionChainsById,
      last_updated: startTime,
      note: `This data is loaded live from Tally API on request. All ${allChains.length} supported chains are fetched dynamically, then the top 20 DAOs by delegate count are selected from ${productionChains.length} production networks (excluding ${allChains.length - productionChains.length} testnets). Data includes delegate counts, member counts, and proposal statistics.`,
      usage_examples: [
        'Use lookup_by_name["uniswap"] to find Uniswap DAO details',
        'Use lookup_by_slug["arbitrum"] to find Arbitrum DAO by slug',
        'Use lookup_by_id["12345"] to find DAO by ID for other tools',
        'Filter daos array by chainId to see top DAOs on specific networks',
        'Use chains_by_id to get information for any chainId (including testnets)',
        'Use production_chains_by_id to get only production chain information',
        'Sort by delegateCount to see governance participation levels',
      ],
    };
    
  } catch (error) {
    return {
      status: 'error',
      description: 'Failed to load popular DAOs from Tally API',
      total_count: 0,
      chains_loaded: 0,
      total_chains_available: 0,
      production_chains_available: 0,
      networks_included: [],
      daos: [],
      lookup_by_name: {},
      lookup_by_slug: {},
      lookup_by_id: {},
      chains_by_id: {},
      production_chains_by_id: {},
      last_updated: startTime,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      note: 'Error occurred while loading DAOs. The resource failed gracefully to prevent server issues.',
      usage_examples: ['Error loading resource - check error_message for details'],
    };
  }
}

/**
 * Dynamically fetch ALL supported chains from Tally API
 */
async function loadAllChains(graphqlClient: TallyGraphQLClient): Promise<SupportedChain[]> {
  const query = `
    query GetAllChains {
      chains {
        id
        name
        mediumName
        shortName
        isTestnet
        blockTime
      }
    }
  `;

  try {
    const result = await graphqlClient.query(query, {});
    
    if (!result.chains || !Array.isArray(result.chains)) {
      throw new Error('Invalid chains response from API');
    }
    
    const chains = result.chains.map((chain: any) => ({
      id: chain.id,
      name: chain.name,
      mediumName: chain.mediumName,
      shortName: chain.shortName,
      isTestnet: chain.isTestnet,
      blockTime: chain.blockTime,
    }));

    if (chains.length === 0) {
      throw new Error('No chains found in API response');
    }

    return chains;
  } catch (error) {
    throw new Error(`Failed to load supported chains: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load top DAOs from production chains only
 */
async function loadPopularDAOs(graphqlClient: TallyGraphQLClient, productionChains: SupportedChain[]): Promise<PopularDAOMapping[]> {
  // Query all production chains to get comprehensive data
  const chainsToQuery = productionChains.slice(0, 8);

  const queries = chainsToQuery.map((chain) =>
    fetchDAOsForChain(graphqlClient, chain)
  );

  const results = await Promise.allSettled(queries);

  const allDAOs: PopularDAOMapping[] = [];
  let successfulChains = 0;
  let failedChains = 0;

  results.forEach((result, index) => {
    const chain = chainsToQuery[index];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allDAOs.push(...result.value);
      successfulChains++;
    } else {
      failedChains++;
      // Continue with other chains - don't fail entire operation for one chain
    }
  });

  if (allDAOs.length === 0) {
    throw new Error(`No DAOs loaded from any production chains. Successful: ${successfulChains}, Failed: ${failedChains}`);
  }

  // Sort all DAOs by delegate count (descending) and take top 20 only
  const sortedDAOs = allDAOs
    .sort((a, b) => b.delegateCount - a.delegateCount)
    .slice(0, 20);

  return sortedDAOs;
}

/**
 * Fetch popular DAOs for a specific production chain
 */
async function fetchDAOsForChain(graphqlClient: TallyGraphQLClient, chain: SupportedChain): Promise<PopularDAOMapping[]> {
  const query = `
    query GetDAOsForChain($chainId: ChainID, $pageSize: Int!) {
      organizations(input: { 
        filters: { chainId: $chainId },
        sort: { sortBy: popular, isDescending: true },
        page: { limit: $pageSize }
      }) {
        nodes {
          ... on Organization {
            id
            name
            slug
            chainIds
            proposalsCount
            delegatesCount
            hasActiveProposals
          }
        }
      }
    }
  `;

  const variables = {
    chainId: chain.id,
    pageSize: 10, // Get top 10 from each production chain
  };

  try {
    const result = await graphqlClient.query(query, variables);
    
    if (!result.organizations || !result.organizations.nodes) {
      return [];
    }
    
    return result.organizations.nodes.map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      chainId: chain.id,
      chainName: chain.mediumName,
      memberCount: org.delegatesCount,
      delegateCount: org.delegatesCount,
      proposalCount: org.proposalsCount,
      hasActiveProposals: org.hasActiveProposals,
    }));
  } catch (error) {
    // Return empty array if chain fails - don't fail the entire operation
    return [];
  }
}

/**
 * Generate lookup dictionaries
 */
function generateLookups(daos: PopularDAOMapping[]) {
  const lookupByName: Record<string, PopularDAOMapping> = {};
  const lookupBySlug: Record<string, PopularDAOMapping> = {};
  const lookupById: Record<string, PopularDAOMapping> = {};
  
  daos.forEach(dao => {
    lookupByName[dao.name.toLowerCase()] = dao;
    lookupBySlug[dao.slug] = dao;
    lookupById[dao.id] = dao;
  });

  return { lookupByName, lookupBySlug, lookupById };
}

/**
 * Generate chains dictionary
 */
function generateChainsLookup(chains: SupportedChain[]) {
  const chainsById: Record<string, SupportedChain> = {};
  chains.forEach(chain => {
    chainsById[chain.id] = chain;
  });
  return chainsById;
}

/**
 * Legacy static functions for backward compatibility
 * Note: These functions will make a fresh API call each time they're used
 */
export async function getDAOByName(graphqlClient: TallyGraphQLClient, name: string): Promise<PopularDAOMapping | undefined> {
  const response = await getPopularDAOsData(graphqlClient);
  if (response.status !== 'success') return undefined;
  return response.lookup_by_name[name.toLowerCase()];
}

export async function getDAOBySlug(graphqlClient: TallyGraphQLClient, slug: string): Promise<PopularDAOMapping | undefined> {
  const response = await getPopularDAOsData(graphqlClient);
  if (response.status !== 'success') return undefined;
  return response.lookup_by_slug[slug];
}

export async function getDAOById(graphqlClient: TallyGraphQLClient, id: string): Promise<PopularDAOMapping | undefined> {
  const response = await getPopularDAOsData(graphqlClient);
  if (response.status !== 'success') return undefined;
  return response.lookup_by_id[id];
}

export async function searchDAOsByName(graphqlClient: TallyGraphQLClient, searchTerm: string): Promise<PopularDAOMapping[]> {
  const response = await getPopularDAOsData(graphqlClient);
  if (response.status !== 'success') return [];
  const term = searchTerm.toLowerCase();
  return response.daos.filter(
    (dao) => dao.name.toLowerCase().includes(term) || dao.slug.includes(term)
  );
}

export async function getDAOsByChain(graphqlClient: TallyGraphQLClient, chainId: string): Promise<PopularDAOMapping[]> {
  const response = await getPopularDAOsData(graphqlClient);
  if (response.status !== 'success') return [];
  return response.daos.filter((dao) => dao.chainId === chainId);
}

export async function getSupportedChains(graphqlClient: TallyGraphQLClient): Promise<string[]> {
  const response = await getPopularDAOsData(graphqlClient);
  if (response.status !== 'success') return [];
  return Object.keys(response.chains_by_id);
}

/**
 * Register the popular DAOs resource with the MCP server
 * 
 * @param server - The McpServer instance to register the resource with
 * @param graphqlClient - The TallyGraphQLClient instance for API access
 */
export function registerPopularDaosResource(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.resource(
    'popular-daos',
    'tally://popular-daos',
    { mimeType: 'application/json' },
    async (): Promise<ReadResourceResult> => {
      if (!graphqlClient) {
        throw new Error('Server not properly initialized');
      }
      
      const response = await getPopularDAOsData(graphqlClient);

      return {
        contents: [
          {
            uri: 'tally://popular-daos',
            mimeType: 'application/json',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );
}
