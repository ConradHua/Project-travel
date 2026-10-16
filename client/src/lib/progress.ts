export type TaskStatus = 'not-started' | 'in-progress' | 'completed';

export type HouseStage = 'empty' | 'foundation' | 'frame' | 'walls-roof' | 'finishing' | 'completed';

export type ProgressTaskInput = {
  status: TaskStatus;
};

export type ProgressSummary = {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  percentage: number;
  stage: HouseStage;
  stageLabel: string;
};

export function stageFromPercentage(percentage: number): { stage: HouseStage; stageLabel: string } {
  if (percentage <= 0) return { stage: 'empty', stageLabel: '空地' };
  if (percentage <= 24) return { stage: 'foundation', stageLabel: '地基' };
  if (percentage <= 49) return { stage: 'frame', stageLabel: '框架' };
  if (percentage <= 74) return { stage: 'walls-roof', stageLabel: '墙体和屋顶' };
  if (percentage <= 99) return { stage: 'finishing', stageLabel: '门窗装修' };
  return { stage: 'completed', stageLabel: '亮灯' };
}

export function summarizeProgress(tasks: readonly ProgressTaskInput[] = []): ProgressSummary {
  let notStarted = 0;
  let inProgress = 0;
  let completed = 0;

  for (const task of tasks) {
    if (task.status === 'completed') completed += 1;
    else if (task.status === 'in-progress') inProgress += 1;
    else notStarted += 1;
  }

  const total = tasks.length;
  let percentage = 0;
  if (total === 0 || completed === 0) {
    percentage = 0;
  } else if (completed === total) {
    percentage = 100;
  } else {
    percentage = Math.min(99, Math.max(1, Math.round((completed / total) * 100)));
  }

  const { stage, stageLabel } = stageFromPercentage(percentage);
  return {
    total,
    notStarted,
    inProgress,
    completed,
    percentage,
    stage,
    stageLabel,
  };
}
