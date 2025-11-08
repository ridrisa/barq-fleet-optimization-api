import DemoDashboard from '@/components/demo-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Route Optimization Demo | BARQ & BULLET',
  description:
    'Real-time demonstration of AI-powered fleet management system for instant delivery services',
};

export default function DemoPage() {
  return <DemoDashboard />;
}
