"use client";

import React from 'react';
import TestUI from './TestUI';
import { useTestSearchLogic } from './useTestSearchLogic';

export default function TestContainer() {
  const { state, actions } = useTestSearchLogic();
  return <TestUI state={state} actions={actions} />;
}
