import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Heading, Button, DynamicTable, Tooltip, Box, xcss, Text } from '@forge/react';
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [tableData, setTableData] = useState([]);

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
      <Text> </Text>
     <Text> </Text>
      <Text> </Text>
      <Box xcss={buttonContainerStyle}>
        <Tooltip content="Export project list to CSV" position="right">
          <Button appearance="primary" text="Export Project List to CSV" onClick={handleExportClick}>Export Projects</Button>
        </Tooltip>
      </Box>
      <Box xcss={tableContainerStyle}>
        <DynamicTable head={tableHead} rows={tableRows} isLoading={loading} emptyView="No data to display" />
      </Box>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);