
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
// Fetch available fields for a given screen ID
resolver.define('getScreenAvailableFields', async (req) => {
  const { screenId } = req.payload;
  if (!screenId) {
    throw new Error('screenId is required');
  }
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/screens/${screenId}/availableFields`);
    const data = await response.json();
    console.log('Screen availableFields response for screenId', screenId, ':', JSON.stringify(data));
    // Return the full data object, not just values
    return data;
  } catch (error) {
    console.error(`Error fetching available fields for screen ${screenId}:`, error);
    return {};
  }
});
// Combined resolver: For each project, get issue type screen scheme, screen scheme, and all screen IDs
resolver.define('getProjectScreenSchemeDetails', async () => {
  const maxResults = 50;
  let startAt = 0;
  let allProjects = [];
  let results = [];
  try {
    // Fetch all projects
    while (true) {
      const response = await api.asApp().requestJira(route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`);
      const data = await response.json();
      if (!data.values || data.values.length === 0) break;
      allProjects = allProjects.concat(data.values);
      if (data.isLast || allProjects.length >= data.total) break;
      startAt += maxResults;
    }
    // For each project, fetch its issue type screen scheme, screen scheme, and screen IDs
    for (const project of allProjects) {
      let issueTypeScreenSchemeId = '';
      let issueTypeScreenSchemeName = '';
      let screenSchemeId = '';
      let screenSchemeName = '';
      let defaultScreenId = '';
      let editScreenId = '';
      let createScreenId = '';
      let viewScreenId = '';
      let error = '';
      try {
        // Issue Type Screen Scheme
        const schemeResp = await api.asApp().requestJira(route`/rest/api/3/issuetypescreenscheme/project?projectId=${project.id}`);
        const schemeData = await schemeResp.json();
        if (schemeData.values && Array.isArray(schemeData.values)) {
          for (const entry of schemeData.values) {
            if (entry.projectIds && entry.projectIds.includes(project.id)) {
              issueTypeScreenSchemeId = entry.issueTypeScreenScheme?.id || '';
              issueTypeScreenSchemeName = entry.issueTypeScreenScheme?.name || '';
              break;
            }
          }
        }
        // Screen Scheme Mapping
        if (issueTypeScreenSchemeId) {
          try {
            const mappingResp = await api.asApp().requestJira(route`/rest/api/3/issuetypescreenscheme/mapping?issueTypeScreenSchemeId=${issueTypeScreenSchemeId}`);
            const mappingData = await mappingResp.json();
            if (mappingData.values && Array.isArray(mappingData.values)) {
              const mapping = mappingData.values[0];
              screenSchemeId = mapping.screenSchemeId || '';
            }
          } catch (err) {
            error = 'Failed to fetch screen scheme mapping.';
          }
        }
        // Screen Scheme Details
        if (screenSchemeId) {
          try {
            const screenSchemeResp = await api.asApp().requestJira(route`/rest/api/3/screenscheme?id=${screenSchemeId}`);
            const screenSchemeData = await screenSchemeResp.json();
            if (screenSchemeData.values && Array.isArray(screenSchemeData.values)) {
              const scheme = screenSchemeData.values.find(s => String(s.id) === String(screenSchemeId));
              if (scheme) {
                screenSchemeName = scheme.name || '';
                const screens = scheme.screens || {};
                defaultScreenId = screens.default || '';
                editScreenId = screens.edit || '';
                createScreenId = screens.create || '';
                viewScreenId = screens.view || '';
                // If only default is present, set all to default
                if (defaultScreenId && !editScreenId && !createScreenId && !viewScreenId) {
                  editScreenId = defaultScreenId;
                  createScreenId = defaultScreenId;
                  viewScreenId = defaultScreenId;
                } else {
                  // If any is missing, fallback to default
                  if (!editScreenId) editScreenId = defaultScreenId;
                  if (!createScreenId) createScreenId = defaultScreenId;
                  if (!viewScreenId) viewScreenId = defaultScreenId;
                }
              }
            }
          } catch (err) {
            error = 'Failed to fetch screen scheme details.';
          }
        }
      } catch (err) {
        error = 'Failed to fetch project screen scheme details.';
      }
      results.push({
        projectId: project.id,
        projectKey: project.key,
        issueTypeScreenSchemeId,
        issueTypeScreenSchemeName,
        screenSchemeId,
        screenSchemeName,
        defaultScreenId,
        editScreenId,
        createScreenId,
        viewScreenId,
        error
      });
    }
    return results;
  } catch (error) {
    console.error('Error fetching project screen scheme details:', error);
    throw error;
  }
});
// Fetch all screen schemes and their screen IDs (default, edit, create, view)
resolver.define('getAllScreenSchemesWithScreens', async () => {
  let startAt = 0;
  const maxResults = 50;
  let allSchemes = [];
  try {
    while (true) {
      const response = await api.asApp().requestJira(route`/rest/api/3/screenscheme?startAt=${startAt}&maxResults=${maxResults}`);
      const data = await response.json();
      if (!data.values || data.values.length === 0) break;
      allSchemes = allSchemes.concat(data.values);
      if (data.isLast || allSchemes.length >= data.total) break;
      startAt += maxResults;
    }
    // Map to table format
    const result = allSchemes.map(scheme => {
      const screens = scheme.screens || {};
      // If edit is present, create and view are same as edit
      let createScreenId = screens.edit || screens.default || '';
      let viewScreenId = screens.edit || screens.default || '';
      let editScreenId = screens.edit || '';
      let defaultScreenId = screens.default || '';
      return {
        id: scheme.id,
        name: scheme.name,
        description: scheme.description,
        defaultScreenId,
        editScreenId,
        createScreenId,
        viewScreenId
      };
    });
    return result;
  } catch (error) {
    console.error('Error fetching screen schemes:', error);
    throw error;
  }
});
// Fetch all project issue type screen scheme IDs for all projects
resolver.define('getAllProjectIssueTypeScreenSchemes', async () => {
  const maxResults = 50;
  let startAt = 0;
  let allProjects = [];
  let results = [];
  try {
    // Fetch all projects
    while (true) {
      const response = await api.asApp().requestJira(route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`);
      const data = await response.json();
      if (!data.values || data.values.length === 0) break;
      allProjects = allProjects.concat(data.values);
      if (data.isLast || allProjects.length >= data.total) break;
      startAt += maxResults;
    }
    // For each project, fetch its issue type screen scheme
    for (const project of allProjects) {
      try {
        const resp = await api.asApp().requestJira(route`/rest/api/3/issuetypescreenscheme/project?projectId=${project.id}`);
        const schemeData = await resp.json();
        let issueTypeScreenSchemeId = '';
        let issueTypeScreenSchemeName = '';
        let screenSchemeId = '';
        let screenSchemeName = '';
        if (schemeData.values && Array.isArray(schemeData.values)) {
          for (const entry of schemeData.values) {
            if (entry.projectIds && entry.projectIds.includes(project.id)) {
              issueTypeScreenSchemeId = entry.issueTypeScreenScheme?.id || '';
              issueTypeScreenSchemeName = entry.issueTypeScreenScheme?.name || '';
              break;
            }
          }
        }
        // Now fetch the screen scheme ID from the mapping endpoint
        if (issueTypeScreenSchemeId) {
          try {
            const mappingResp = await api.asApp().requestJira(route`/rest/api/3/issuetypescreenscheme/mapping?issueTypeScreenSchemeId=${issueTypeScreenSchemeId}`);
            const mappingData = await mappingResp.json();
            if (mappingData.values && Array.isArray(mappingData.values)) {
              // Take the first mapping (usually only one per scheme)
              const mapping = mappingData.values[0];
              screenSchemeId = mapping.screenSchemeId || '';
            }
          } catch (err) {
            // Ignore mapping errors, just leave screenSchemeId blank
          }
        }
        // Now fetch the screen scheme name using the screen scheme ID
        if (screenSchemeId) {
          try {
            const screenSchemeResp = await api.asApp().requestJira(route`/rest/api/3/screenscheme?id=${screenSchemeId}`);
            const screenSchemeData = await screenSchemeResp.json();
            if (screenSchemeData.values && Array.isArray(screenSchemeData.values)) {
              const scheme = screenSchemeData.values.find(s => String(s.id) === String(screenSchemeId));
              if (scheme) {
                screenSchemeName = scheme.name || '';
              }
            }
          } catch (err) {
            // Ignore errors, just leave screenSchemeName blank
          }
        }
        results.push({ projectId: project.id, projectKey: project.key, issueTypeScreenSchemeId, issueTypeScreenSchemeName, screenSchemeId, screenSchemeName });
      } catch (err) {
        results.push({ projectId: project.id, projectKey: project.key, error: 'Failed to fetch issue type screen scheme.' });
      }
    }
    return results;
  } catch (error) {
    console.error('Error fetching all project issue type screen schemes:', error);
    throw error;
  }
});
// Fetch issue type screen scheme for a given project ID
resolver.define('getProjectIssueTypeScreenScheme', async (req) => {
  const { projectId } = req.payload;
  if (!projectId) {
    throw new Error('projectId is required');
  }
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/issuetypescreenscheme/project?projectId=${projectId}`);
    const data = await response.json();
    // Find the scheme for this project
    let schemeObj = { projectId, issueTypeScreenSchemeId: '', name: '', description: '' };
    if (data.values && Array.isArray(data.values)) {
      for (const entry of data.values) {
        if (entry.projectIds && entry.projectIds.includes(projectId)) {
          schemeObj = {
            projectId,
            issueTypeScreenSchemeId: entry.issueTypeScreenScheme?.id || '',
            name: entry.issueTypeScreenScheme?.name || '',
            description: entry.issueTypeScreenScheme?.description || ''
          };
          break;
        }
      }
    }
    return schemeObj;
  } catch (error) {
    console.error(`Error fetching issue type screen scheme for project ${projectId}:`, error);
    return { projectId, error: 'Failed to fetch issue type screen scheme.' };
  }
});
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
