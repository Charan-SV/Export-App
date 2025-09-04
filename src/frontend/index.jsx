import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Heading, Button, DynamicTable, Tooltip, Box, xcss, Text } from '@forge/react';
// Removed UI Kit Table import
import { invoke } from '@forge/bridge';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { format } from 'date-fns';

const headerStyle = xcss({
  marginBottom: 'space.300',
  textAlign: 'center',
  color: 'color.text.accent.blue',
});

const buttonContainerStyle = xcss({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: 'space.300',
});

const tableContainerStyle = xcss({
  marginTop: 'space.300',
});

const App = () => {
  // ...existing code...
  const handleExportPermissionSchemes = () => {
    // Merge project key and name into permissionSchemes
    const exportData = permissionSchemes.map(scheme => {
      const project = tableData.find(p => p.id === scheme.projectId);
      return {
        projectId: scheme.projectId,
        projectKey: project ? project.key : '',
        projectName: project ? project.name : '',
        name: scheme.name,
        description: scheme.description,
        schemeId: scheme.id,
        error: scheme.error || ''
      };
    });
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'permission_schemes.csv');
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [permissionSchemes, setPermissionSchemes] = useState([]);
  const [permLoading, setPermLoading] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projects = await invoke('getProjects');
        const projectData = projects.map(project => ({
          id: project.id,
          key: project.key,
          name: project.name,
          lead: project.lead,
          accountId: project.accountId,
          totalIssueCount: project.insight.totalIssueCount,
          lastIssueUpdateTime: format(new Date(project.insight.lastIssueUpdateTime), 'dd-MM-yyyy HH:mm')
        }));
        setLoading(false);
        if (projectData.length === 0) {
          setShowWarning(true);
        } else {
          setTableData(projectData);
          // Fetch permission schemes for each project
          setPermLoading(true);
          const schemes = await Promise.all(projectData.map(async project => {
            try {
              const scheme = await invoke('getProjectPermissionScheme', { projectIdOrKey: project.id });
              return { projectId: project.id, ...scheme };
            } catch (error) {
              return { projectId: project.id, error: 'Failed to fetch permission scheme.' };
            }
          }));
          setPermissionSchemes(schemes);
          setPermLoading(false);

        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        setLoading(false);
        setShowWarning(true);
      }
    };

    fetchProjects();
  }, []);

  const handleExportClick = () => {
    exportToCSV(tableData);
  };

  const exportToCSV = (data) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'projects.csv');
  };

  const tableHead = {
    cells: [
      { key: 'id', content: 'ID' },
      { key: 'key', content: 'Key' },
      { key: 'name', content: 'Name' },
      { key: 'lead', content: 'Lead' },
      { key: 'accountId', content: 'Account ID' },
      { key: 'totalIssueCount', content: 'Total Issue Count' },
      { key: 'lastIssueUpdateTime', content: 'Last Issue Update Time' }
    ]
  };

  const tableRows = tableData.map(project => ({
    key: project.id,
    cells: [
      { key: 'id', content: project.id },
      { key: 'key', content: project.key },
      { key: 'name', content: project.name },
      { key: 'lead', content: project.lead },
      { key: 'accountId', content: project.accountId },
      { key: 'totalIssueCount', content: project.totalIssueCount },
      { key: 'lastIssueUpdateTime', content: project.lastIssueUpdateTime }
    ]
  }));

  return (
    <>
      <Box xcss={headerStyle}>
        <Heading as="h3" level="h600" xcss={headerStyle} appearance="primary">Projects</Heading>
      </Box>
      <Text> </Text>
      <Box xcss={buttonContainerStyle}>
        <Tooltip content="Export project list to CSV" position="right">
          <Button appearance="primary" text="Export Project List to CSV" onClick={handleExportClick}>Export Projects</Button>
        </Tooltip>
      </Box>
      <Box xcss={tableContainerStyle}>
        <DynamicTable head={tableHead} rows={tableRows} isLoading={loading} emptyView="No data to display" />
      </Box>

      {/* Permission Schemes Section as DynamicTable */}
      <Box xcss={headerStyle}>
        <Heading as="h4" level="h500" appearance="primary">Project Permission Schemes</Heading>
      </Box>
      <Box xcss={buttonContainerStyle}>
        <Tooltip content="Export permission schemes to CSV" position="right">
          <Button appearance="primary" text="Export Permission Schemes to CSV" onClick={handleExportPermissionSchemes}>Export Permission Schemes</Button>
        </Tooltip>
      </Box>
      {permLoading && <Text>Loading permission schemes...</Text>}
      {!permLoading && permissionSchemes.length > 0 && (
        <DynamicTable
          head={{
            cells: [
              { key: 'projectId', content: 'Project ID' },
              { key: 'projectKey', content: 'Project Key' },
              { key: 'projectName', content: 'Project Name' },
              { key: 'name', content: 'Name' },
              { key: 'description', content: 'Description' },
              { key: 'schemeId', content: 'Scheme ID' }
            ]
          }}
          rows={permissionSchemes.map(scheme => {
            const project = tableData.find(p => p.id === scheme.projectId);
            return {
              key: scheme.projectId,
              cells: [
                { key: 'projectId', content: scheme.projectId },
                { key: 'projectKey', content: project ? project.key : '' },
                { key: 'projectName', content: project ? project.name : '' },
                { key: 'name', content: scheme.error ? <Text color="red">{scheme.error}</Text> : scheme.name },
                { key: 'description', content: scheme.error ? '' : scheme.description },
                { key: 'schemeId', content: scheme.error ? '' : scheme.id }
              ]
            };
          })}
          isLoading={permLoading}
          emptyView="No permission schemes to display"
        />
      )}
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);