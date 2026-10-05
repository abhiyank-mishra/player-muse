"use client";

import React from 'react';
import { useAdminLogic } from './useAdminLogic';
import { AdminUI } from './AdminUI';

export function AdminContainer() {
  const adminState = useAdminLogic();
  return <AdminUI {...adminState} />;
}
