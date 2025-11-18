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
  Zap,
  Users,
  Target,
  Brain
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductionStatistics } from '@/components/production-statistics';

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
      icon: <Brain className="h-8 w-8" />,
      title: 'Autonomous Operations',
      description: 'Self-learning AI orchestrator with autonomous decision-making, action authorization, and continuous learning from operations.',
      status: 'active',
      href: '/autonomous'
    },
    {
      icon: <Bot className="h-8 w-8" />,
      title: 'AI Agents Management',
      description: 'Manage and monitor AI agents for fleet rebalancing, demand forecasting, and intelligent decision-making.',
      status: 'active',
      href: '/admin/agents'
    },
    {
      icon: <Target className="h-8 w-8" />,
      title: 'Fleet Manager',
      description: 'AI-powered driver target tracking, SLA compliance monitoring, and intelligent order assignment. Ensure all drivers meet targets and all orders delivered within 1-4 hours.',
      status: 'active',
      href: '/fleet-manager'
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
      path: '/api/v1/fleet-manager/targets/status',
      description: 'Get driver target achievement status'
    },
    {
      method: 'POST',
      path: '/api/v1/fleet-manager/ai/suggest-driver',
      description: 'AI-powered driver assignment recommendations'
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
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-purple-500/5 to-background">
        <div className="absolute inset-0 bg-grid-white/5 bg-[size:32px_32px]" style={{
          backgroundImage: 'linear-gradient(to right, rgb(0 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.05) 1px, transparent 1px)'
        }} />
        <div className="container relative mx-auto px-4 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 px-6 py-3 rounded-full mb-8 shadow-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                AI-Powered Logistics Platform
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-8 bg-gradient-to-r from-primary via-purple-600 to-primary bg-clip-text text-transparent leading-tight">
              AI Route Optimization System
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
              Advanced logistics optimization platform powered by AI agents, real-time analytics,
              and intelligent routing algorithms. <strong className="text-foreground">Optimize your fleet operations</strong> with enterprise-grade features.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/optimize">
                <Button size="lg" className="gap-2 text-base px-8 py-6 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300">
                  Start Optimizing
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 py-6 border-2 hover:bg-primary/5 hover:border-primary transition-all duration-300">
                  Try Demo
                  <Rocket className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">

        {/* Production Statistics */}
        <div className="mb-16">
          <ProductionStatistics />
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Link key={index} href={feature.href}>
                <Card className="group p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 hover:-translate-y-2 h-full">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 group-hover:scale-110">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{feature.title}</h3>
                        <Badge
                          variant={feature.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {feature.status === 'active' ? 'Active' : feature.status === 'beta' ? 'Beta' : 'Soon'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                        {feature.description}
                      </p>
                      <div className="flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
                        Open
                        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-2 transition-transform duration-300" />
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
