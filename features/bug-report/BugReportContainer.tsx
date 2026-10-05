"use client";

import React, { useEffect } from 'react';
import { useBugReportLogic } from './useBugReportLogic';
import { BugReportUI } from './BugReportUI';
import ErrorCollector from '@/core/error/ErrorCollector';

export function BugReportContainer() {
  const {
    isOpen,
    isSubmitting,
    comment,
    setComment,
    closeBugReport,
    handleSubmit
  } = useBugReportLogic();

  useEffect(() => {
    // Initialize error collector globally when container mounts.
    ErrorCollector.init();
  }, []);

  return (
    <BugReportUI 
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      comment={comment}
      setComment={setComment}
      onClose={closeBugReport}
      onSubmit={handleSubmit}
    />
  );
}
