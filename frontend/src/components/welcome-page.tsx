'use client';

import Link from 'next/link';
import {
  MapPin,
  BarChart3,
  Bot,
  Cog,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Activity,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'active' | 'beta' | 'coming-soon';
  href: string;
}

export function WelcomePage() {
  const features: Feature[] = [
    {
      icon: <MapPin className="h-8 w-8" />,
      title: 'Route Optimization',
      description: 'AI-powered route planning with real-time traffic, time windows, and capacity constraints. Optimize delivery routes for multiple vehicles.',
      status: 'active',
      href: '/optimize'
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: 'Analytics Dashboard',
      description: 'Real-time SLA monitoring, performance metrics, and operational KPIs. Track delivery compliance and fleet efficiency.',
      status: 'active',
      href: '/analytics'
    },
    {
      icon: <Rocket className="h-8 w-8" />,
      title: 'Demo Playground',
      description: 'Interactive demo environment to test optimization capabilities with sample data and scenarios.',
      status: 'active',
      href: '/demo'
    },
    {
      icon: <Cog className="h-8 w-8" />,
      title: 'Automation Center',
      description: 'Automated routing workflows, scheduled optimizations, and batch processing capabilities.',
      status: 'active',
      href: '/automation'
    },
    {
      icon: <Bot className="h-8 w-8" />,
      title: 'AI Agents Management',
      description: 'Manage and monitor AI agents for fleet rebalancing, demand forecasting, and intelligent decision-making.',
      status: 'active',
      href: '/admin/agents'
    }
  ];

  const capabilities = [
    'Multi-vehicle route optimization',
    'Time window constraints',
    'Vehicle capacity management',
    'Real-time traffic integration',
    'Restricted area handling',
    'Priority-based delivery',
    'Cost optimization',
    'SLA compliance tracking'
  ];

  const apiEndpoints = [
    {
      method: 'POST',
      path: '/api/v1/optimize',
      description: 'Create optimized delivery routes'
    },
    {
      method: 'GET',
      path: '/api/v1/analytics',
      description: 'Fetch performance analytics'
    },
    {
      method: 'GET',
      path: '/api/v1/agents',
      description: 'List AI agents status'
    },
    {
      method: 'GET',
      path: '/api/v1/health',
      description: 'System health check'
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">AI-Powered Logistics Platform</span>
          </div>

          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Route Optimization System
          </h1>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Advanced logistics optimization platform powered by AI agents, real-time analytics,
            and intelligent routing algorithms. Optimize your fleet operations with enterprise-grade features.
          </p>

          <div className="flex gap-4 justify-center">
            <Link href="/optimize">
              <Button size="lg" className="gap-2">
                Start Optimizing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="gap-2">
                Try Demo
                <Rocket className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Link key={index} href={feature.href}>
                <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50 h-full">
                  <div className="flex items-start gap-4">
                    <div className="text-primary mt-1">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{feature.title}</h3>
                        <Badge
                          variant={feature.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {feature.status === 'active' ? 'Active' : feature.status === 'beta' ? 'Beta' : 'Soon'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {feature.description}
                      </p>
                      <div className="flex items-center text-primary text-sm font-medium">
                        Open
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Capabilities Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <Card className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">Core Capabilities</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {capabilities.map((capability, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{capability}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">API Endpoints</h2>
            </div>
            <div className="space-y-4">
              {apiEndpoints.map((endpoint, index) => (
                <div key={index} className="border-l-4 border-primary/30 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {endpoint.method}
                    </Badge>
                    <code className="text-sm font-mono">{endpoint.path}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {endpoint.description}
                  </p>
                </div>
              ))}
              <Link href="https://route-opt-backend-426674819922.us-central1.run.app/api-docs" target="_blank">
                <Button variant="outline" size="sm" className="w-full mt-4">
                  View Full API Documentation
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* System Status */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-1">Frontend</h3>
              <p className="text-sm text-muted-foreground">Next.js 14 • Operational</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-1">Backend API</h3>
              <p className="text-sm text-muted-foreground">Node.js • Cloud Run</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-1">Analytics</h3>
              <p className="text-sm text-muted-foreground">PostgreSQL • Active</p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
