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
  const [permissionSchemes, setPermissionSchemes] = useState([]);
  const [permLoading, setPermLoading] = useState(false);
  const [issueTypeSchemes, setIssueTypeSchemes] = useState([]);
  const [issueTypeLoading, setIssueTypeLoading] = useState(false);
  const [workflowSchemes, setWorkflowSchemes] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Workflows for each workflow scheme (map schemeId to workflow names)
  const [schemeWorkflows, setSchemeWorkflows] = useState({});
  const [schemeWorkflowsLoading, setSchemeWorkflowsLoading] = useState(false);

  // Issue Type Screen Schemes (from new resolver)
  const [screenSchemes, setScreenSchemes] = useState([]);
  const [screenSchemesLoading, setScreenSchemesLoading] = useState(false);

  const [projectScreenRows, setProjectScreenRows] = useState([]);

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

          // Fetch issue type schemes for each project
          setIssueTypeLoading(true);
          const issueSchemes = await Promise.all(projectData.map(async project => {
            try {
              const scheme = await invoke('getProjectIssueTypeScheme', { projectId: project.id });
              return { projectId: project.id, ...scheme };
            } catch (error) {
              return { projectId: project.id, error: 'Failed to fetch issue type scheme.' };
            }
          }));
          setIssueTypeSchemes(issueSchemes);
          setIssueTypeLoading(false);

          // Fetch workflow schemes for each project
          setWorkflowLoading(true);
          const workflowSchemesData = await Promise.all(projectData.map(async project => {
            try {
              const scheme = await invoke('getProjectWorkflowScheme', { projectId: project.id });
              return { projectId: project.id, ...scheme };
            } catch (error) {
              return { projectId: project.id, error: 'Failed to fetch workflow scheme.' };
            }
          }));
          setWorkflowSchemes(workflowSchemesData);
          setWorkflowLoading(false);

          // Fetch workflows for each workflow scheme and map to schemeId
          setSchemeWorkflowsLoading(true);
          const workflowsMap = {};
          await Promise.all(workflowSchemesData.map(async scheme => {
            if (scheme.id && !scheme.error) {
              try {
                const wfData = await invoke('getWorkflowsForScheme', { workflowschemaid: scheme.id });
                // API returns array of objects with 'workflow' string property
                const workflowArr = Array.isArray(wfData) ? wfData : (wfData.values || []);
                workflowsMap[scheme.id] = workflowArr.map(wf => wf.workflow || '').filter(Boolean);
              } catch (error) {
                workflowsMap[scheme.id] = [];
              }
            }
          }));
          setSchemeWorkflows(workflowsMap);
          setSchemeWorkflowsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        setLoading(false);
        setShowWarning(true);
      }
    };

    fetchProjects();
  }, []);

  // Fetch all project issue type screen schemes on mount
  useEffect(() => {
    setScreenSchemesLoading(true);
    invoke('getAllProjectIssueTypeScreenSchemes').then((data) => {
      setScreenSchemes(data);
      setScreenSchemesLoading(false);
    }).catch((err) => {
      setScreenSchemes([]);
      setScreenSchemesLoading(false);
    });
  }, []);

  useEffect(() => {
    invoke('getProjectScreenSchemeDetails').then((data) => {
      setProjectScreenRows(data);
    }).catch(() => {
      setProjectScreenRows([]);
    });
  }, []);

  const handleExportClick = () => {
    exportToCSV(tableData);
  };

  const exportToCSV = (data) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'projects.csv');
  };

  const handleExportPermissionSchemes = () => {
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

  const handleExportIssueTypeSchemes = () => {
    const exportData = issueTypeSchemes.map(scheme => {
      const project = tableData.find(p => p.id === scheme.projectId);
      return {
        projectId: scheme.projectId,
        projectKey: project ? project.key : '',
        projectName: project ? project.name : '',
        name: scheme.name || '',
        schemeId: scheme.id || '',
        error: scheme.error || ''
      };
    });
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'issue_type_schemes.csv');
  };

  const handleExportWorkflowSchemes = () => {
    const exportData = workflowSchemes.map(scheme => {
      const project = tableData.find(p => p.id === scheme.projectId);
      return {
        projectId: scheme.projectId,
        projectKey: project ? project.key : '',
        projectName: project ? project.name : '',
        name: scheme.name || '',
        schemeId: scheme.id || '',
        workflows: schemeWorkflows[scheme.id]?.join(', ') || '',
        error: scheme.error || ''
      };
    });
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'workflow_schemes.csv');
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
  <React.Fragment>
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
                { key: 'schemeId', content: scheme.error ? '' : scheme.id }
              ]
            };
          })}
          isLoading={permLoading}
          emptyView="No permission schemes to display"
        />
      )}

      {/* Issue Type Schemes Section as DynamicTable */}
      <Box xcss={headerStyle}>
        <Heading as="h4" level="h500" appearance="primary">Project Issue Type Schemes</Heading>
      </Box>
      <Box xcss={buttonContainerStyle}>
        <Tooltip content="Export issue type schemes to CSV" position="right">
          <Button appearance="primary" text="Export Issue Type Schemes to CSV" onClick={handleExportIssueTypeSchemes}>Export Issue Type Schemes</Button>
        </Tooltip>
      </Box>
      {issueTypeLoading && <Text>Loading issue type schemes...</Text>}
      {!issueTypeLoading && issueTypeSchemes.length > 0 && (
        <DynamicTable
          head={{
            cells: [
              { key: 'projectId', content: 'Project ID' },
              { key: 'projectKey', content: 'Project Key' },
              { key: 'projectName', content: 'Project Name' },
              { key: 'name', content: 'Name' },
              { key: 'schemeId', content: 'Scheme ID' }
            ]
          }}
          rows={issueTypeSchemes.map(scheme => {
            const project = tableData.find(p => p.id === scheme.projectId);
            return {
              key: scheme.projectId,
              cells: [
                { key: 'projectId', content: scheme.projectId },
                { key: 'projectKey', content: project ? project.key : '' },
                { key: 'projectName', content: project ? project.name : '' },
                { key: 'name', content: scheme.error ? <Text color="red">{scheme.error}</Text> : scheme.name },
                { key: 'schemeId', content: scheme.error ? '' : scheme.id }
              ]
            };
          })}
          isLoading={issueTypeLoading}
          emptyView="No issue type schemes to display"
        />
      )}

      {/* Workflow Schemes Section as DynamicTable */}
      <Box xcss={headerStyle}>
        <Heading as="h4" level="h500" appearance="primary">Project Workflow Schemes</Heading>
      </Box>
      <Box xcss={buttonContainerStyle}>
        <Tooltip content="Export workflow schemes to CSV" position="right">
          <Button appearance="primary" text="Export Workflow Schemes to CSV" onClick={handleExportWorkflowSchemes}>Export Workflow Schemes</Button>
        </Tooltip>
      </Box>
      {(workflowLoading || schemeWorkflowsLoading) && <Text>Loading workflow schemes...</Text>}
      {!workflowLoading && !schemeWorkflowsLoading && workflowSchemes.length > 0 && (
        <DynamicTable
          head={{
            cells: [
              { key: 'projectId', content: 'Project ID' },
              { key: 'projectKey', content: 'Project Key' },
              { key: 'projectName', content: 'Project Name' },
              { key: 'name', content: 'Name' },
              { key: 'schemeId', content: 'Scheme ID' },
              { key: 'workflows', content: 'Workflows' }
            ]
          }}
          rows={workflowSchemes.map(scheme => {
            const project = tableData.find(p => p.id === scheme.projectId);
            return {
              key: scheme.projectId,
              cells: [
                { key: 'projectId', content: scheme.projectId },
                { key: 'projectKey', content: project ? project.key : '' },
                { key: 'projectName', content: project ? project.name : '' },
                { key: 'name', content: scheme.error ? <Text color="red">{scheme.error}</Text> : scheme.name },
                { key: 'schemeId', content: scheme.error ? '' : scheme.id },
                { key: 'workflows', content: schemeWorkflows[scheme.id]?.length ? schemeWorkflows[scheme.id].join(', ') : <Text color="red">No workflows found</Text> }
              ]
            };
          })}
          isLoading={workflowLoading || schemeWorkflowsLoading}
          emptyView="No workflow schemes to display"
        />
      )}

      {/* Combined Project Screen Scheme Details Section as DynamicTable */}
      <Box xcss={headerStyle}>
        <Heading as="h4" level="h500" appearance="primary">Project Screen Scheme Details</Heading>
        <ExportProjectInfoButton rows={projectScreenRows} />
      </Box>
      <ProjectScreenSchemeTable rows={projectScreenRows} />
    </React.Fragment>
  );
};

function ScreenSchemesTable() {
  const [screenSchemes, setScreenSchemes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    invoke('getAllScreenSchemesWithScreens').then((data) => {
      setScreenSchemes(data);
      setLoading(false);
    }).catch(() => {
      setScreenSchemes([]);
      setLoading(false);
    });
  }, []);

  return (
    <Box xcss={tableContainerStyle}>
      <DynamicTable
        head={{
          cells: [
            { key: 'id', content: 'Screen Scheme ID' },
            { key: 'name', content: 'Screen Scheme Name' },
            { key: 'description', content: 'Description' },
            { key: 'defaultScreenId', content: 'Default Screen ID' },
            { key: 'editScreenId', content: 'Edit Screen ID' },
            { key: 'createScreenId', content: 'Create Screen ID' },
            { key: 'viewScreenId', content: 'View Screen ID' }
          ]
        }}
        rows={screenSchemes.map(scheme => ({
          key: scheme.id,
          cells: [
            { key: 'id', content: scheme.id },
            { key: 'name', content: scheme.name },
            { key: 'description', content: scheme.description },
            { key: 'defaultScreenId', content: scheme.defaultScreenId },
            { key: 'editScreenId', content: scheme.editScreenId },
            { key: 'createScreenId', content: scheme.createScreenId },
            { key: 'viewScreenId', content: scheme.viewScreenId }
          ]
        }))}
        isLoading={loading}
        emptyView="No screen schemes to display"
      />
    </Box>
  );
}

function ProjectScreenSchemeTable({ rows }) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFields, setModalFields] = useState([]);
  const [modalScreenId, setModalScreenId] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalScreenIds, setModalScreenIds] = useState({});
  const [modalFieldsByScreen, setModalFieldsByScreen] = useState({});
  // Remove duplicate fetch. Use rows prop directly.

  const handleViewFields = async (row) => {
    setModalScreenId(row.defaultScreenId);
    setModalScreenIds({
      default: row.defaultScreenId,
      edit: row.editScreenId,
      create: row.createScreenId,
      view: row.viewScreenId
    });
    setModalLoading(true);
    setModalOpen(true);
    const ids = [
      { type: 'Default', id: row.defaultScreenId },
      { type: 'Edit', id: row.editScreenId },
      { type: 'Create', id: row.createScreenId },
      { type: 'View', id: row.viewScreenId }
    ];
    const uniqueIds = Array.from(new Set(ids.map(i => i.id))).filter(Boolean);
    const fieldsByScreen = {};
    for (const screenId of uniqueIds) {
      try {
        let fields = await invoke('getScreenAvailableFields', { screenId });
        if (!Array.isArray(fields) && fields && fields.values) {
          fields = fields.values;
        }
        fieldsByScreen[String(screenId)] = Array.isArray(fields) ? fields : [];
      } catch {
        fieldsByScreen[String(screenId)] = [];
      }
    }
    setModalFieldsByScreen(fieldsByScreen);
    setModalLoading(false);
  };

  const handleExportFields = () => {
    const fieldHeaders = [
      'Field ID for Default',
      'Field Name for Default',
      'Create Screen Field Name',
      'Edit Screen Field Name',
      'View Screen Field Name'
    ];
    const csvRows = [fieldHeaders.join(',')];
    rows.forEach(row => {
      csvRows.push(row.cells.map(cell => `"${cell.content}"`).join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_screen_fields.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const headers = [
      'Project ID',
      'Project Key',
      'Issue Type Screen Scheme ID',
      'Issue Type Screen Scheme Name',
      'Screen Scheme ID',
      'Screen Scheme Name',
      'Default Screen ID',
      'Edit Screen ID',
      'Create Screen ID',
      'View Screen ID'
    ];
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      csvRows.push([
        row.projectId || '',
        row.projectKey || '',
        row.issueTypeScreenSchemeId || '',
        row.issueTypeScreenSchemeName || '',
        row.screenSchemeId || '',
        row.screenSchemeName || '',
        row.defaultScreenId || '',
        row.editScreenId || '',
        row.createScreenId || '',
        row.viewScreenId || ''
      ].map(v => `"${v}"`).join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_screen_projects.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box xcss={tableContainerStyle}>
      <DynamicTable
        head={{
          cells: [
            { key: 'projectId', content: 'Project ID' },
            { key: 'projectKey', content: 'Project Key' },
            { key: 'issueTypeScreenSchemeId', content: 'Issue Type Screen Scheme ID' },
            { key: 'issueTypeScreenSchemeName', content: 'Issue Type Screen Scheme Name' },
            { key: 'screenSchemeId', content: 'Screen Scheme ID' },
            { key: 'screenSchemeName', content: 'Screen Scheme Name' },
            { key: 'defaultScreenId', content: 'Default Screen ID' },
            { key: 'editScreenId', content: 'Edit Screen ID' },
            { key: 'createScreenId', content: 'Create Screen ID' },
            { key: 'viewScreenId', content: 'View Screen ID' },
            { key: 'view', content: 'View Fields' },
            { key: 'error', content: 'Error' }
          ]
        }}
        rows={rows.map(row => ({
          key: row.projectId,
          cells: [
            { key: 'projectId', content: row.projectId },
            { key: 'projectKey', content: row.projectKey },
            { key: 'issueTypeScreenSchemeId', content: row.issueTypeScreenSchemeId },
            { key: 'issueTypeScreenSchemeName', content: row.issueTypeScreenSchemeName },
            { key: 'screenSchemeId', content: row.screenSchemeId },
            { key: 'screenSchemeName', content: row.screenSchemeName },
            { key: 'defaultScreenId', content: row.defaultScreenId },
            { key: 'editScreenId', content: row.editScreenId },
            { key: 'createScreenId', content: row.createScreenId },
            { key: 'viewScreenId', content: row.viewScreenId },
            { key: 'view', content: <Button appearance="primary" onClick={() => handleViewFields(row)}>View Fields</Button> },
            { key: 'error', content: row.error ? <Text color="red">{row.error}</Text> : '' }
          ]
        }))}
        isLoading={loading}
        emptyView="No project screen scheme details to display"
      />
      {modalOpen && (
        <Box xcss={{
          padding: 'space.400',
          borderRadius: 'border.radius.200',
          backgroundColor: 'color.background.overlay',
          margin: 'auto',
          marginTop: 'space.400',
          width: '80%'
        }}>
          <Heading as="h5" level="h400">Fields for Project Screens</Heading>
          {modalLoading ? <Text>Loading fields...</Text> : (
            <>
              {/* Build a table with default screen fields and unique screen fields */}
              {(() => {
                // Get default screen fields
                const defaultId = modalScreenIds.default;
                const defaultFields = Array.isArray(modalFieldsByScreen[String(defaultId)]) ? modalFieldsByScreen[String(defaultId)] : [];
                // Find unique screen IDs (edit, create, view) that are different from default
                const uniqueScreens = Object.entries(modalScreenIds)
                  .filter(([type, id]) => type !== 'default' && id && id !== defaultId)
                  .map(([type, id]) => ({ type, id: String(id) }));
                // For each unique screen, get its fields
                const uniqueFieldsByScreen = uniqueScreens.map(screen => ({
                  type: screen.type,
                  id: screen.id,
                  fields: Array.isArray(modalFieldsByScreen[screen.id]) ? modalFieldsByScreen[screen.id] : []
                }));
                // Prepare separate columns for Create, Edit, and View screens
                const screenTypes = ['create', 'edit', 'view'];
                // Collect all field IDs from all screens
                const allFieldIds = new Set([
                  ...defaultFields.map(f => f.id),
                  ...uniqueFieldsByScreen.flatMap(screen => screen.fields.map(f => f.id))
                ]);

                // Build rows for each field, always show ID if present in that screen
                rows = Array.from(allFieldIds).map(fieldId => {
                  const defaultField = defaultFields.find(f => f.id === fieldId);
                  // For each screen, find the field object (id and name)
                  const createFieldObj = uniqueFieldsByScreen.find(s => s.type === 'create')?.fields.find(f => f.id === fieldId);
                  const editFieldObj = uniqueFieldsByScreen.find(s => s.type === 'edit')?.fields.find(f => f.id === fieldId);
                  const viewFieldObj = uniqueFieldsByScreen.find(s => s.type === 'view')?.fields.find(f => f.id === fieldId);
                  return {
                    key: fieldId,
                    cells: [
                      { key: 'defaultFieldId', content: defaultField ? defaultField.id : '' },
                      { key: 'defaultFieldName', content: defaultField ? defaultField.name : '' },
                      { key: 'createFieldId', content: createFieldObj ? createFieldObj.id : '' },
                      { key: 'createFieldName', content: createFieldObj ? createFieldObj.name : '' },
                      { key: 'editFieldId', content: editFieldObj ? editFieldObj.id : '' },
                      { key: 'editFieldName', content: editFieldObj ? editFieldObj.name : '' },
                      { key: 'viewFieldId', content: viewFieldObj ? viewFieldObj.id : '' },
                      { key: 'viewFieldName', content: viewFieldObj ? viewFieldObj.name : '' }
                    ]
                  };
                });
                // Export to CSV handler
                const handleExport = () => {
                  const fieldHeaders = [
                    'Field ID for Default',
                    'Field Name for Default',
                    'Field ID for Create',
                    'Field Name for Create',
                    'Field ID for Edit',
                    'Field Name for Edit',
                    'Field ID for View',
                    'Field Name for View'
                  ];
                  const csvRows = [fieldHeaders.join(',')];
                  rows.forEach(row => {
                    // If cells are in the order: defaultId, defaultName, createId, createName, editId, editName, viewId, viewName
                    csvRows.push(row.cells.map(cell => `"${cell.content}"`).join(','));
                  });
                  const csvContent = csvRows.join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'project_screen_fields.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                };
                // Only show Project Screen Scheme Details heading in main table, not modal
                return (
                  <>
                    {/* Only show Project Screen Scheme Details heading in main table, not modal */}
                    <Button appearance="primary" onClick={handleExport}>Export CSV</Button>
                    <DynamicTable
                      head={{
                        cells: [
                          { key: 'defaultFieldId', content: 'Field ID for Default' },
                          { key: 'defaultFieldName', content: 'Field Name for Default' },
                          { key: 'createFieldId', content: 'Field ID for Create' },
                          { key: 'createFieldName', content: 'Field Name for Create' },
                          { key: 'editFieldId', content: 'Field ID for Edit' },
                          { key: 'editFieldName', content: 'Field Name for Edit' },
                          { key: 'viewFieldId', content: 'Field ID for View' },
                          { key: 'viewFieldName', content: 'Field Name for View' }
                        ]
                      }}
                      rows={rows}
                      isLoading={false}
                      emptyView="No fields found"
                    />
                  </>
                );
              })()}
              <Button appearance="default" text="Close" onClick={() => setModalOpen(false)} />
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

function ExportProjectInfoButton({ rows }) {
  const handleExportProjects = () => {
    const headers = [
      'Project ID',
      'Project Key',
      'Issue Type Screen Scheme ID',
      'Issue Type Screen Scheme Name',
      'Screen Scheme ID',
      'Screen Scheme Name',
      'Default Screen ID',
      'Edit Screen ID',
      'Create Screen ID',
      'View Screen ID'
    ];
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      csvRows.push([
        row.projectId || '',
        row.projectKey || '',
        row.issueTypeScreenSchemeId || '',
        row.issueTypeScreenSchemeName || '',
        row.screenSchemeId || '',
        row.screenSchemeName || '',
        row.defaultScreenId || '',
        row.editScreenId || '',
        row.createScreenId || '',
        row.viewScreenId || ''
      ].map(v => `"${v}"`).join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_screen_projects.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return <Button appearance="primary" onClick={handleExportProjects}>Export Project Info CSV</Button>;
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);