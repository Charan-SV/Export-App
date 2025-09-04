
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getProjects', async (req) => {
  console.log('getProjects resolver called');
  const maxResults = 50;
  let startAt = 0;
  let allProjects = [];

  try {
    while (true) {
      const response = await api.asApp().requestJira(route`/rest/api/3/project/search?expand=insight,lead&startAt=${startAt}&maxResults=${maxResults}`);
      const data = await response.json();
      const projectData = data.values.map(project => ({
        id: project.id,
        key: project.key,
        name: project.name,
        lead: project.lead.displayName,
        accountId: project.lead.accountId,
        insight: project.insight // Include insight details
      }));
      allProjects = allProjects.concat(projectData);

      if (data.isLast || allProjects.length >= maxResults) {
        break;
      }
      startAt += maxResults;
    }

    console.log('Projects data:', allProjects);
    return allProjects.slice(0, maxResults);
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
});

export const handler = resolver.getDefinitions();
// Fetch issue type scheme for a given project ID
resolver.define('getProjectIssueTypeScheme', async (req) => {
  const { projectId } = req.payload;
  if (!projectId) {
    throw new Error('projectId is required');
  }
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/issuetypescheme/project?projectId=${projectId}`);
    const data = await response.json();
    // Find the scheme for this project
    let schemeObj = { projectId, name: '', description: '', id: '' };
    if (data.values && Array.isArray(data.values)) {
      for (const entry of data.values) {
        if (entry.projectIds && entry.projectIds.includes(projectId)) {
          schemeObj = {
            projectId,
            name: entry.issueTypeScheme?.name || '',
            description: '', // No description in response
            id: entry.issueTypeScheme?.id || ''
          };
          break;
        }
      }
    }
    return schemeObj;
  } catch (error) {
    console.error(`Error fetching issue type scheme for project ${projectId}:`, error);
    return { projectId, error: 'Failed to fetch issue type scheme.' };
  }
});
// Fetch workflow scheme for a given project ID
resolver.define('getProjectWorkflowScheme', async (req) => {
  const { projectId } = req.payload;
  if (!projectId) {
    throw new Error('projectId is required');
  }
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/workflowscheme/project?projectId=${projectId}`);
    const data = await response.json();
    // Find the scheme for this project
    let schemeObj = { projectId, name: '', description: '', id: '' };
    if (data.values && Array.isArray(data.values)) {
      for (const entry of data.values) {
        if (entry.projectIds && entry.projectIds.includes(projectId)) {
          schemeObj = {
            projectId,
            name: entry.workflowScheme?.name || '',
            description: entry.workflowScheme?.description || '',
            id: entry.workflowScheme?.id || ''
          };
          break;
        }
      }
    }
    return schemeObj;
  } catch (error) {
    console.error(`Error fetching workflow scheme for project ${projectId}:`, error);
    return { projectId, error: 'Failed to fetch workflow scheme.' };
  }
});
// Fetch workflows for a workflow scheme ID
resolver.define('getWorkflowsForScheme', async (req) => {
  const { workflowschemaid } = req.payload;
  if (!workflowschemaid) {
    throw new Error('workflowschemaid is required');
  }
  try {
    const response = await api.asApp().requestJira(route`/rest/api/2/workflowscheme/${workflowschemaid}/workflow`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching workflows for scheme ${workflowschemaid}:`, error);
    return { workflowschemaid, error: 'Failed to fetch workflows for scheme.' };
  }
});
// Fetch permission scheme for a given project ID or key
resolver.define('getProjectPermissionScheme', async (req) => {
  const { projectIdOrKey } = req.payload;
  if (!projectIdOrKey) {
    throw new Error('projectIdOrKey is required');
  }
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/project/${projectIdOrKey}/permissionscheme`);
    const permissionScheme = await response.json();
    return permissionScheme;
  } catch (error) {
    console.error(`Error fetching permission scheme for project ${projectIdOrKey}:`, error);
    throw error;
  }
});
