import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getProjects', async (req) => {
  console.log('getProjects resolver called');
  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/project/search?expand=insight,lead`);
    const data = await response.json();
    const projectData = data.values.map(project => ({
      id: project.id,
      key: project.key,
      name: project.name,
      lead: project.lead.displayName,
      accountId: project.lead.accountId,
      insight: project.insight // Include insight details
    }));
    console.log('Projects data:', projectData);
    return projectData;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
});

export const handler = resolver.getDefinitions();