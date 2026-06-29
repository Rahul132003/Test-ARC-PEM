import { useEffect } from 'react';

export function useLogActivity(
  projectId: string | undefined,
  project: { name: string; client: string } | null,
  type: string,
  subLabel: string
) {
  useEffect(() => {
    if (!projectId || !project) return;
    window.electronAPI.logActivity({
      type,
      project_id: projectId,
      project_name: project.name,
      client_name: project.client,
      sub_label: subLabel,
      route: `/project/${projectId}/${type}`,
    }).catch(() => {});
  }, [projectId, project?.name, type, subLabel]);
}
