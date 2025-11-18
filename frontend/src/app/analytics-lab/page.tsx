'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaFlask, FaChartLine, FaUsers, FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaTachometerAlt } from 'react-icons/fa';

// Define types
interface AnalyticsJob {
  jobId: string;
  type: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  result?: any;
  error?: string;
  params?: any;
}

interface DashboardStats {
  running_jobs: number;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: string;
  avg_duration: string;
  recent_jobs: AnalyticsJob[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

export default function AnalyticsLabPage() {
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [runningJobs, setRunningJobs] = useState<AnalyticsJob[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Route Analysis state
  const [routeParams, setRouteParams] = useState({
    analysis_type: 'efficiency',
    date_range: '30',
    hub_id: '',
    min_deliveries: '10'
  });
  const [routeJob, setRouteJob] = useState<AnalyticsJob | null>(null);

  // Fleet Performance state
  const [fleetParams, setFleetParams] = useState({
    analysis_type: 'driver',
    metric: 'delivery_rate',
    period: 'monthly',
    driver_id: '',
    vehicle_id: ''
  });
  const [fleetJob, setFleetJob] = useState<AnalyticsJob | null>(null);

  // Demand Forecast state
  const [demandParams, setDemandParams] = useState({
    forecast_type: 'daily',
    horizon: '7',
    hub_id: ''
  });
  const [demandJob, setDemandJob] = useState<AnalyticsJob | null>(null);

  // SLA Analysis state
  const [slaParams, setSlaParams] = useState({
    analysis_type: 'compliance',
    date_range: '30',
    hub_id: ''
  });
  const [slaJob, setSlaJob] = useState<AnalyticsJob | null>(null);

  // Load dashboard stats
  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Poll for running jobs
  useEffect(() => {
    const checkJobs = () => {
      if (routeJob && routeJob.status === 'running') {
        pollJobStatus(routeJob.jobId, setRouteJob);
      }
      if (fleetJob && fleetJob.status === 'running') {
        pollJobStatus(fleetJob.jobId, setFleetJob);
      }
      if (demandJob && demandJob.status === 'running') {
        pollJobStatus(demandJob.jobId, setDemandJob);
      }
      if (slaJob && slaJob.status === 'running') {
        pollJobStatus(slaJob.jobId, setSlaJob);
      }
    };

    const interval = setInterval(checkJobs, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [routeJob, fleetJob, demandJob, slaJob]);

  const loadDashboard = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/dashboard`);
      const data = await response.json();
      if (data.success) {
        setDashboardStats(data.dashboard);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  const pollJobStatus = async (jobId: string, setJob: (job: AnalyticsJob) => void) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/job/${jobId}`);
      const data = await response.json();
      if (data.success && data.job) {
        setJob(data.job as AnalyticsJob);
      }
    } catch (error) {
      console.error(`Failed to poll job ${jobId}:`, error);
    }
  };

  const runRouteAnalysis = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/run/route-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...routeParams,
          date_range: parseInt(routeParams.date_range),
          hub_id: routeParams.hub_id ? parseInt(routeParams.hub_id) : undefined,
          min_deliveries: parseInt(routeParams.min_deliveries)
        })
      });
      const data = await response.json();
      if (data.success) {
        setRouteJob({ jobId: data.jobId, status: 'running', type: 'route_analysis', startedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to run route analysis:', error);
    }
  };

  const runFleetPerformance = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/run/fleet-performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fleetParams,
          driver_id: fleetParams.driver_id ? parseInt(fleetParams.driver_id) : undefined,
          vehicle_id: fleetParams.vehicle_id ? parseInt(fleetParams.vehicle_id) : undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        setFleetJob({ jobId: data.jobId, status: 'running', type: 'fleet_performance', startedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to run fleet performance:', error);
    }
  };

  const runDemandForecast = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/run/demand-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...demandParams,
          horizon: parseInt(demandParams.horizon),
          hub_id: demandParams.hub_id ? parseInt(demandParams.hub_id) : undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        setDemandJob({ jobId: data.jobId, status: 'running', type: 'demand_forecast', startedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to run demand forecast:', error);
    }
  };

  const runSLAAnalysis = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/run/sla-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slaParams,
          date_range: parseInt(slaParams.date_range),
          hub_id: slaParams.hub_id ? parseInt(slaParams.hub_id) : undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        setSlaJob({ jobId: data.jobId, status: 'running', type: 'sla_analysis', startedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to run SLA analysis:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <FaSpinner className="animate-spin text-blue-500" />;
      case 'completed':
        return <FaCheckCircle className="text-green-500" />;
      case 'failed':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaClock className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <FaFlask className="text-4xl text-purple-400" />
          <div>
            <h1 className="text-4xl font-bold">Analytics Lab</h1>
            <p className="text-gray-400">Run Python analytics scripts on 2.8M+ production orders</p>
          </div>
        </div>
      </motion.div>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8"
        >
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Running Jobs</p>
                <p className="text-3xl font-bold text-blue-400">{dashboardStats.running_jobs}</p>
              </div>
              <FaSpinner className="text-3xl text-blue-400 animate-spin" />
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Jobs</p>
                <p className="text-3xl font-bold">{dashboardStats.total_jobs}</p>
              </div>
              <FaTachometerAlt className="text-3xl text-gray-400" />
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-3xl font-bold text-green-400">{dashboardStats.completed_jobs}</p>
              </div>
              <FaCheckCircle className="text-3xl text-green-400" />
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Success Rate</p>
                <p className="text-3xl font-bold text-purple-400">{dashboardStats.success_rate}%</p>
              </div>
              <FaChartLine className="text-3xl text-purple-400" />
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Duration</p>
                <p className="text-3xl font-bold text-yellow-400">{dashboardStats.avg_duration}s</p>
              </div>
              <FaClock className="text-3xl text-yellow-400" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Analytics Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Route Efficiency Analyzer */}
        <AnalyticsModule
          title="Route Efficiency Analyzer"
          description="Analyze route performance, identify bottlenecks, and perform ABC analysis"
          icon={<FaChartLine className="text-3xl text-blue-400" />}
          params={routeParams}
          setParams={setRouteParams}
          onRun={runRouteAnalysis}
          job={routeJob}
          getStatusIcon={getStatusIcon}
          getStatusColor={getStatusColor}
          fields={[
            { name: 'analysis_type', label: 'Analysis Type', type: 'select', options: ['efficiency', 'bottlenecks', 'abc'] },
            { name: 'date_range', label: 'Date Range (days)', type: 'number' },
            { name: 'hub_id', label: 'Hub ID (optional)', type: 'number' },
            { name: 'min_deliveries', label: 'Min Deliveries', type: 'number' }
          ]}
        />

        {/* Fleet Performance Analyzer */}
        <AnalyticsModule
          title="Fleet Performance Analyzer"
          description="Analyze driver and vehicle performance with DPI/VPI metrics"
          icon={<FaUsers className="text-3xl text-green-400" />}
          params={fleetParams}
          setParams={setFleetParams}
          onRun={runFleetPerformance}
          job={fleetJob}
          getStatusIcon={getStatusIcon}
          getStatusColor={getStatusColor}
          fields={[
            { name: 'analysis_type', label: 'Analysis Type', type: 'select', options: ['driver', 'vehicle', 'cohort'] },
            { name: 'metric', label: 'Metric', type: 'select', options: ['delivery_rate', 'efficiency', 'productivity'] },
            { name: 'period', label: 'Period', type: 'select', options: ['daily', 'weekly', 'monthly'] },
            { name: 'driver_id', label: 'Driver ID (optional)', type: 'number' },
            { name: 'vehicle_id', label: 'Vehicle ID (optional)', type: 'number' }
          ]}
        />

        {/* Demand Forecaster */}
        <AnalyticsModule
          title="Demand Forecaster"
          description="Predict delivery demand patterns and resource requirements"
          icon={<FaClock className="text-3xl text-purple-400" />}
          params={demandParams}
          setParams={setDemandParams}
          onRun={runDemandForecast}
          job={demandJob}
          getStatusIcon={getStatusIcon}
          getStatusColor={getStatusColor}
          fields={[
            { name: 'forecast_type', label: 'Forecast Type', type: 'select', options: ['hourly', 'daily', 'resource'] },
            { name: 'horizon', label: 'Horizon (days)', type: 'number' },
            { name: 'hub_id', label: 'Hub ID (optional)', type: 'number' }
          ]}
        />

        {/* SLA Analytics */}
        <AnalyticsModule
          title="SLA Analytics"
          description="Track SLA compliance and delivery time performance"
          icon={<FaTachometerAlt className="text-3xl text-yellow-400" />}
          params={slaParams}
          setParams={setSlaParams}
          onRun={runSLAAnalysis}
          job={slaJob}
          getStatusIcon={getStatusIcon}
          getStatusColor={getStatusColor}
          fields={[
            { name: 'analysis_type', label: 'Analysis Type', type: 'select', options: ['compliance', 'performance', 'trends'] },
            { name: 'date_range', label: 'Date Range (days)', type: 'number' },
            { name: 'hub_id', label: 'Hub ID (optional)', type: 'number' }
          ]}
        />

      </div>
    </div>
  );
}

// Analytics Module Component
interface AnalyticsModuleProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  params: any;
  setParams: (params: any) => void;
  onRun: () => void;
  job: AnalyticsJob | null;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
  fields: { name: string; label: string; type: string; options?: string[] }[];
}

function AnalyticsModule({
  title,
  description,
  icon,
  params,
  setParams,
  onRun,
  job,
  getStatusIcon,
  getStatusColor,
  fields
}: AnalyticsModuleProps) {
  const [showResults, setShowResults] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
        {job && (
          <div className="flex items-center gap-2">
            {getStatusIcon(job.status)}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
              {job.status.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Parameters Form */}
      <div className="space-y-3 mb-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm text-gray-400 mb-1">{field.label}</label>
            {field.type === 'select' ? (
              <select
                value={params[field.name]}
                onChange={(e) => setParams({ ...params, [field.name]: e.target.value })}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                disabled={job?.status === 'running'}
              >
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={params[field.name]}
                onChange={(e) => setParams({ ...params, [field.name]: e.target.value })}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                disabled={job?.status === 'running'}
                placeholder={field.label}
              />
            )}
          </div>
        ))}
      </div>

      {/* Run Button */}
      <button
        onClick={onRun}
        disabled={job?.status === 'running'}
        className={`w-full py-3 rounded-lg font-semibold transition-all ${
          job?.status === 'running'
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
        }`}
      >
        {job?.status === 'running' ? 'Running...' : 'Run Analysis'}
      </button>

      {/* Job Info */}
      {job && (
        <div className="mt-4 p-4 bg-gray-700/30 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Job ID: {job.jobId}</span>
            <span className="text-sm text-gray-400">
              {job.duration ? `${job.duration.toFixed(2)}s` : 'Running...'}
            </span>
          </div>

          {job.status === 'completed' && job.result && (
            <div>
              <button
                onClick={() => setShowResults(!showResults)}
                className="text-blue-400 hover:text-blue-300 text-sm mb-2"
              >
                {showResults ? 'Hide Results' : 'Show Results'}
              </button>
              {showResults && (
                <pre className="text-xs bg-gray-900 p-3 rounded overflow-auto max-h-60">
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {job.status === 'failed' && job.error && (
            <div className="text-red-400 text-sm">
              <p className="font-semibold">Error:</p>
              <p className="text-xs">{job.error}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
