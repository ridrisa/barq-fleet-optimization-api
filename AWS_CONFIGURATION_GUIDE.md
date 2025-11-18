# AWS RDS Configuration Guide for BarqFleet Production Database

## Overview
This guide explains how to configure AWS access to connect your local development environment to the BarqFleet production PostgreSQL database.

---

## Option 1: AWS VPN/Client VPN (Recommended for Secure Access)

### Prerequisites
- AWS Client VPN endpoint configured
- VPN configuration file (.ovpn)
- OpenVPN client installed

### Steps

1. **Install AWS VPN Client**
   ```bash
   # macOS
   brew install --cask aws-vpn-client

   # Or download from: https://aws.amazon.com/vpn/client-vpn-download/
   ```

2. **Connect to VPN**
   - Open AWS VPN Client
   - Import the `.ovpn` configuration file
   - Connect to the VPN

3. **Verify Connection**
   ```bash
   # Test RDS connectivity
   nc -zv barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com 5432
   ```

4. **Run Your Application**
   ```bash
   cd backend
   npm run dev
   ```

---

## Option 2: SSH Tunnel via Bastion Host

If you have a bastion/jump server in AWS:

### Prerequisites
- EC2 bastion host with RDS access
- SSH key for bastion
- Security group allows PostgreSQL (5432)

### Steps

1. **Create SSH Tunnel**
   ```bash
   # Replace with your bastion details
   ssh -i ~/.ssh/your-key.pem \
     -L 5433:barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com:5432 \
     ec2-user@your-bastion-ip -N
   ```

2. **Update Environment Variables**
   ```bash
   # backend/.env.local
   BARQ_PROD_DB_HOST=localhost
   BARQ_PROD_DB_PORT=5433
   BARQ_PROD_DB_NAME=barqfleet_db
   BARQ_PROD_DB_USER=ventgres
   BARQ_PROD_DB_PASSWORD=Jk56tt4HkzePFfa3ht
   BARQ_PROD_DB_SSL=false
   ```

3. **Run Your Application**
   ```bash
   cd backend
   npm run dev
   ```

---

## Option 3: AWS Systems Manager Session Manager

### Prerequisites
- AWS CLI installed and configured
- Session Manager plugin installed
- IAM permissions for SSM

### Steps

1. **Install Session Manager Plugin**
   ```bash
   # macOS
   brew install --cask session-manager-plugin

   # Verify installation
   session-manager-plugin
   ```

2. **Install AWS CLI** (if not already installed)
   ```bash
   brew install awscli
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (me-south-1), Output format (json)
   ```

3. **Find Your Bastion Instance ID**
   ```bash
   aws ec2 describe-instances \
     --region me-south-1 \
     --filters "Name=tag:Name,Values=*bastion*" \
     --query "Reservations[].Instances[].[InstanceId,Tags[?Key=='Name'].Value|[0]]" \
     --output table
   ```

4. **Start Port Forwarding Session**
   ```bash
   # Replace i-xxxxxxxxxxxxx with your bastion instance ID
   aws ssm start-session \
     --region me-south-1 \
     --target i-xxxxxxxxxxxxx \
     --document-name AWS-StartPortForwardingSessionToRemoteHost \
     --parameters '{
       "portNumber":["5432"],
       "localPortNumber":["5433"],
       "host":["barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com"]
     }'
   ```

5. **Update Environment Variables** (same as Option 2)

---

## Option 4: Security Group Update (Development Only)

⚠️ **WARNING**: Only use this for temporary development. NOT recommended for production.

### Steps

1. **Get Your Public IP**
   ```bash
   curl ifconfig.me
   ```

2. **Update RDS Security Group**
   - Log into AWS Console
   - Navigate to RDS → Databases → barqfleet-db-prod-stack-read-replica
   - Click on the VPC security group
   - Add Inbound Rule:
     - Type: PostgreSQL
     - Protocol: TCP
     - Port: 5432
     - Source: Your IP/32 (e.g., 203.0.113.42/32)
     - Description: "Temporary dev access"

3. **Test Connection**
   ```bash
   psql -h barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com \
        -U ventgres \
        -d barqfleet_db \
        -p 5432
   # Password: Jk56tt4HkzePFfa3ht
   ```

4. **Remove Rule When Done** (Important for security)

---

## Option 5: Cloud Run Deployment (Production Recommended)

Deploy your backend to Google Cloud Run in the same region as RDS:

### Prerequisites
- Google Cloud SDK installed
- Project configured

### Steps

1. **Install Google Cloud SDK**
   ```bash
   brew install --cask google-cloud-sdk
   gcloud init
   ```

2. **Set Environment Variables**
   ```bash
   # backend/.env.production
   BARQ_PROD_DB_HOST=barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com
   BARQ_PROD_DB_PORT=5432
   BARQ_PROD_DB_NAME=barqfleet_db
   BARQ_PROD_DB_USER=ventgres
   BARQ_PROD_DB_PASSWORD=Jk56tt4HkzePFfa3ht
   BARQ_PROD_DB_SSL=true
   ```

3. **Create VPC Connector** (for AWS RDS access)
   ```bash
   gcloud compute networks vpc-access connectors create barq-connector \
     --region=me-west1 \
     --network=default \
     --range=10.8.0.0/28
   ```

4. **Deploy to Cloud Run**
   ```bash
   cd backend

   # Build and deploy
   gcloud run deploy route-opt-backend \
     --source . \
     --region=me-west1 \
     --platform=managed \
     --vpc-connector=barq-connector \
     --set-env-vars="BARQ_PROD_DB_HOST=barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com,BARQ_PROD_DB_PORT=5432,BARQ_PROD_DB_NAME=barqfleet_db,BARQ_PROD_DB_USER=ventgres" \
     --set-secrets="BARQ_PROD_DB_PASSWORD=barq-db-password:latest"
   ```

---

## Verifying Connection

Once configured, test the connection:

### 1. Test Connection Endpoint
```bash
curl http://localhost:3002/api/v1/barq-production/test-connection
```

**Expected Response**:
```json
{
  "success": true,
  "timestamp": "2025-11-18T15:30:00.000Z",
  "message": "Successfully connected to BarqFleet production database"
}
```

### 2. Test Statistics Endpoint
```bash
curl http://localhost:3002/api/v1/barq-production/statistics
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_orders": 2800000,
    "total_couriers": 5000,
    "total_hubs": 50,
    "total_shipments": 150000,
    "today_orders": 1200,
    "pending_orders": 350,
    "online_couriers": 800,
    "active_shipments": 120
  }
}
```

### 3. Test Fleet Manager Dashboard
```bash
curl http://localhost:3002/api/v1/fleet-manager/production/dashboard
```

### 4. Check Server Logs
```bash
# Should see these logs:
# BarqFleet production database connection successful
# Fetched hubs from BarqFleet production
# Fetched couriers from BarqFleet production
```

---

## Troubleshooting

### Connection Timeout
```
Error: connect ETIMEDOUT
```

**Solutions**:
1. Check VPN connection is active
2. Verify security group rules
3. Confirm RDS endpoint is correct
4. Test with `telnet` or `nc`:
   ```bash
   nc -zv barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com 5432
   ```

### Authentication Failed
```
Error: password authentication failed for user "ventgres"
```

**Solutions**:
1. Verify credentials in environment variables
2. Check password doesn't have special characters that need escaping
3. Ensure user has correct permissions:
   ```sql
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO ventgres;
   ```

### SSL Connection Error
```
Error: SSL connection failed
```

**Solutions**:
1. Download RDS CA certificate:
   ```bash
   wget https://truststore.pki.rds.amazonaws.com/me-south-1/me-south-1-bundle.pem
   ```

2. Update connection config:
   ```javascript
   ssl: {
     rejectUnauthorized: true,
     ca: fs.readFileSync('./me-south-1-bundle.pem').toString()
   }
   ```

### Region Access Issues
```
Error: Could not connect to the endpoint URL
```

**Solutions**:
1. Ensure AWS CLI is configured for `me-south-1` region:
   ```bash
   aws configure set region me-south-1
   ```

2. Enable opt-in regions:
   ```bash
   aws account enable-region --region-name me-south-1
   ```

---

## Security Best Practices

### 1. Use IAM Database Authentication (Recommended)
```javascript
const AWS = require('aws-sdk');
const signer = new AWS.RDS.Signer();

const token = await signer.getAuthToken({
  hostname: 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
  port: 5432,
  region: 'me-south-1',
  username: 'ventgres'
});

// Use token as password
```

### 2. Rotate Credentials Regularly
- Store password in AWS Secrets Manager
- Rotate every 90 days
- Use secrets in environment variables

### 3. Use Read-Only User for Analytics
```sql
CREATE USER analytics_readonly WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_readonly;
```

### 4. Enable SSL/TLS
- Always use SSL in production
- Verify server certificates
- Use TLS 1.2 or higher

### 5. Monitor Access
- Enable RDS Enhanced Monitoring
- Set up CloudWatch alarms
- Log all queries with pg_stat_statements

---

## Quick Reference

### Environment Variables
```bash
# .env.local (for local development with VPN/tunnel)
BARQ_PROD_DB_HOST=barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com
BARQ_PROD_DB_PORT=5432
BARQ_PROD_DB_NAME=barqfleet_db
BARQ_PROD_DB_USER=ventgres
BARQ_PROD_DB_PASSWORD=Jk56tt4HkzePFfa3ht
BARQ_PROD_DB_SSL=true

# .env.local (for local development with SSH tunnel)
BARQ_PROD_DB_HOST=localhost
BARQ_PROD_DB_PORT=5433
BARQ_PROD_DB_NAME=barqfleet_db
BARQ_PROD_DB_USER=ventgres
BARQ_PROD_DB_PASSWORD=Jk56tt4HkzePFfa3ht
BARQ_PROD_DB_SSL=false
```

### Testing Commands
```bash
# 1. Test TCP connection
nc -zv barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com 5432

# 2. Test PostgreSQL connection
psql -h barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com \
     -U ventgres -d barqfleet_db

# 3. Test API endpoint
curl http://localhost:3002/api/v1/barq-production/test-connection

# 4. Watch server logs
tail -f backend/logs/combined.log | grep -i "barq"
```

---

## Recommended Setup for Different Environments

### Development (Local)
- **Option 2**: SSH Tunnel via Bastion
- **Why**: Simple, secure, no VPN client needed

### Staging
- **Option 5**: Cloud Run Deployment
- **Why**: Closest to production environment

### Production
- **Option 5**: Cloud Run with VPC Connector
- **Why**: Native cloud-to-cloud connectivity, high performance, secure

---

## Contact AWS Administrator

If you don't have access to:
- Bastion host SSH keys
- VPN configuration files
- AWS Console access
- Security group modification rights

**Contact your AWS administrator** to:
1. Request VPN access
2. Get bastion host credentials
3. Request security group rule addition
4. Enable SSM Session Manager

---

## Next Steps

1. Choose the appropriate option based on your access level
2. Follow the configuration steps
3. Test the connection using verification commands
4. Check server logs for successful connection
5. Test production endpoints with real data

Once configured, all production data will flow seamlessly through your application!
