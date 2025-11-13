#!/bin/bash

echo "Waiting for build to complete..."
for i in {1..15}; do
  sleep 10
  STATUS=$(gcloud builds list --limit=1 --format="value(status)")
  echo "[$((i * 10))s] Status: $STATUS"
  if [ "$STATUS" = "SUCCESS" ]; then
    echo ""
    echo "✅ BUILD SUCCESSFUL!"
    gcloud builds list --limit=1 --format="table(id,createTime,finishTime,duration)"
    echo ""
    echo "🧪 Running endpoint tests..."
    ./test-eighth-deployment.sh | tee eighth-deployment-test-results.txt
    exit 0
  fi
done

echo ""
echo "⏰ Build still in progress after 150 seconds..."
gcloud builds list --limit=1 --format="table(id,status,createTime)"
