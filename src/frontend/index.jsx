import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Button } from '@forge/react';
import { invoke } from '@forge/bridge';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { format } from 'date-fns';

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    invoke('getText', { example: 'my-invoke-variable' }).then(setData);
  }, []);

  const handleExportClick = async () => {
    setLoading(true);
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
        exportToCSV(projectData);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setLoading(false);
      setShowWarning(true);
    }
  };

  const exportToCSV = (data) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'projects.csv');
  };

  return (
    <>
      <Text>Export your project list to a CSV file.</Text>
      <Button appearance="primary" text="Export Project List to CSV" onClick={handleExportClick}>Export Projects</Button>
      {loading && <Text>Loading...</Text>}
      {showWarning && <Text>No projects found.</Text>}
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);