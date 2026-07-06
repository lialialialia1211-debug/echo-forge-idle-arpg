import type { ReactNode } from "react";
import type { HomeProgressStepId, HomeProgressStepProjection } from "./runtimeSelectors";

export type HomeProgressStepMeta = Record<HomeProgressStepId, { icon: ReactNode; title: string; detail: string }>;

type HomeProgressTrackProps = {
  activeStepId: HomeProgressStepId;
  headingLabel: string;
  progressLabel: string;
  stepMeta: HomeProgressStepMeta;
  steps: HomeProgressStepProjection[];
};

export function HomeProgressTrack({ activeStepId, headingLabel, progressLabel, stepMeta, steps }: HomeProgressTrackProps) {
  const activeStep = stepMeta[activeStepId];

  return (
    <div className="home-quest-track" aria-label={headingLabel}>
      <div className="home-quest-head">
        <small>{headingLabel}</small>
        <strong>{activeStep.title}</strong>
        <span>{activeStep.detail}</span>
      </div>
      <div className="home-progress-steps" role="list" aria-label={progressLabel}>
        {steps.map((step, index) => {
          const meta = stepMeta[step.id];
          return (
            <div className={`home-progress-step home-progress-step-${step.status}`} key={step.id} role="listitem">
              <small>{index + 1}</small>
              {meta.icon}
              <span>
                <strong>{meta.title}</strong>
                <em>{meta.detail}</em>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
