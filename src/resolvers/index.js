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
      const response = await api.asUser().requestJira(route`/rest/api/3/project/search?expand=insight,lead&startAt=${startAt}&maxResults=${maxResults}`);
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