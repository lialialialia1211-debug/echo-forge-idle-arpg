import type { CombatCondition, CombatEvent } from "./topTypes";
import type { TopDerivedPhysics } from "./topPhysics";

export type CombatContext = {
  physics: TopDerivedPhysics;
  spinEnergyRatio: number;
  fluxRatio: number;
  omega: number;
  events: CombatEvent[];
};

function compare(left: number, op: Extract<CombatCondition, { kind: "attr" }>["op"], right: number): boolean {
  switch (op) {
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "==":
      return Math.abs(left - right) < 0.0001;
    default:
      return false;
  }
}

export function attrValueForCondition(context: CombatContext, attr: Extract<CombatCondition, { kind: "attr" }>["attr"]): number {
  if (attr === "mass") {
    return context.physics.designMass;
  }
  if (attr === "volume") {
    return context.physics.volume;
  }
  if (attr === "spinEnergyRatio") {
    return context.spinEnergyRatio;
  }
  if (attr === "fluxRatio") {
    return context.fluxRatio;
  }
  if (attr === "maxFlux") {
    return context.physics.maxFlux;
  }
  return context.omega;
}

export function evaluateCombatCondition(condition: CombatCondition | undefined, context: CombatContext | undefined): boolean {
  if (!condition) {
    return true;
  }
  if (!context) {
    return false;
  }
  if (condition.kind === "attr") {
    return compare(attrValueForCondition(context, condition.attr), condition.op, condition.value);
  }
  if (condition.kind === "event") {
    return context.events.some((event) => event.kind === condition.event);
  }
  if (condition.kind === "and") {
    return condition.terms.every((term) => evaluateCombatCondition(term, context));
  }
  return condition.terms.some((term) => evaluateCombatCondition(term, context));
}
