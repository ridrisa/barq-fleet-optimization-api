'use client';

import React from 'react';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  FaDatabase, 
  FaFlask, 
  FaShieldAlt, 
  FaExclamationTriangle,
  FaInfoCircle 
} from 'react-icons/fa';

interface DataSourceIndicatorProps {
  dataSource?: string;
  dataQuality?: string;
  isDemo?: boolean;
  showAlert?: boolean;
  className?: string;
}

export const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({
  dataSource = 'unknown',
  dataQuality = 'unknown',
  isDemo = false,
  showAlert = true,
  className = ''
}) => {
  const isProduction = dataSource === 'production';
  const isDemoData = isDemo || dataSource === 'demo' || dataQuality === 'demo';

  const getBadgeVariant = () => {
    if (isProduction) return 'default';
    if (isDemoData) return 'secondary';
    return 'outline';
  };

  const getBadgeContent = () => {
    if (isProduction) {
      return (
        <>
          <FaDatabase className="h-3 w-3 mr-1" />
          Production Data
        </>
      );
    } else if (isDemoData) {
      return (
        <>
          <FaFlask className="h-3 w-3 mr-1" />
          Demo Data
        </>
      );
    } else {
      return (
        <>
          <FaExclamationTriangle className="h-3 w-3 mr-1" />
          Unknown Source
        </>
      );
    }
  };

  const getQualityInfo = () => {
    switch (dataQuality) {
      case 'high':
        return 'High quality production data';
      case 'demo':
        return 'Realistic demo data for Saudi Arabia';
      case 'low':
        return 'Limited or degraded data quality';
      default:
        return 'Data quality unknown';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Badge Indicator */}
      <div className="flex items-center gap-2">
        <Badge variant={getBadgeVariant()} className="flex items-center">
          {getBadgeContent()}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {getQualityInfo()}
        </span>
      </div>

      {/* Alert for Demo Data */}
      {showAlert && isDemoData && (
        <Alert>
          <FaInfoCircle className="h-4 w-4" />
          <AlertDescription>
            This data is generated for demonstration purposes and represents realistic Saudi Arabian fleet operations. 
            Results may not reflect actual production metrics.
          </AlertDescription>
        </Alert>
      )}

      {/* Alert for Unknown Source */}
      {showAlert && dataSource === 'unknown' && (
        <Alert variant="destructive">
          <FaExclamationTriangle className="h-4 w-4" />
          <AlertDescription>
            Data source could not be determined. Please check system connectivity and try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

interface ResultsWithDataSourceProps {
  children: React.ReactNode;
  result?: any;
  className?: string;
}

export const ResultsWithDataSource: React.FC<ResultsWithDataSourceProps> = ({
  children,
  result,
  className = ''
}) => {
  const dataSource = result?.data_source || result?.connection_info?.analyzer_data_source || result?.connection_info?.forecaster_data_source;
  const dataQuality = result?.data_quality;
  const isDemo = dataSource === 'demo' || dataQuality === 'demo';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Data Source Indicator */}
      {(dataSource || dataQuality) && (
        <DataSourceIndicator
          dataSource={dataSource}
          dataQuality={dataQuality}
          isDemo={isDemo}
          showAlert={false}
          className="mb-4"
        />
      )}
      
      {/* Results Content */}
      {children}
      
      {/* Bottom Demo Warning for Demo Data */}
      {isDemo && (
        <Alert className="mt-4">
          <FaFlask className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo Data Notice:</strong> These results are based on realistic Saudi Arabian demo data. 
            Verify with production data when database connectivity is restored.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DataSourceIndicator;