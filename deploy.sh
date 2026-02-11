#!/bin/bash

# Configuration
# BUCKET_NAME=$1
BUCKET_NAME="albadri-demo"
REGION="us-east-1" # Change this if needed

# ⚠️ SECURITY WARNING: Hardcoding credentials is not recommended.
# Use this ONLY if you understand the risks and are in a secure environment.
export AWS_ACCESS_KEY_ID=${PERSONAL_AWS_ACCESS_KEY_ID}
export AWS_SECRET_ACCESS_KEY=${PERSONAL_AWS_SECRET_ACCESS_KEY}
if [ -z "$BUCKET_NAME" ]; then
    echo "Usage: ./deploy.sh <bucket-name>"
    exit 1
fi

echo "🚀 Deploying to S3 bucket: $BUCKET_NAME"

# 1. Create bucket if it doesn't exist
aws s3 mb s3://$BUCKET_NAME --region $REGION

# 2. Configure bucket for static website hosting
aws s3 website s3://$BUCKET_NAME/ --index-document index.html --error-document index.html

# 3. Disable Block Public Access (required for public policies)
echo "🔓 Disabling Block Public Access..."
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# 4. Apply Public Read Policy
echo "📜 Applying Public Read Policy..."
# Update the policy file with the bucket name
sed "s/BUCKET_NAME/$BUCKET_NAME/g" bucket-policy.json > policy-tmp.json
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://policy-tmp.json
rm policy-tmp.json

# 5. Sync files to S3
# Only deploy files required for the public frontend
echo "📂 Syncing frontend files..."
aws s3 sync . s3://$BUCKET_NAME \
    --exclude "*" \
    --include "index.html" \
    --include "properties.html" \
    --include "property-details.html" \
    --include "assets/favicon.png" \
    --include "assets/hero.jpg" \
    --include "assets/logo.png" \
    --include "assets/styles/*" \
    --include "assets/scripts/*" \
    --include "assets/components/*"

# 6. Create required foldes if they don't exist
echo "📁 Ensuring required folders exist on S3..."
aws s3api put-object --bucket $BUCKET_NAME --key assets/props-imgs/ > /dev/null 2>&1 || true
aws s3api put-object --bucket $BUCKET_NAME --key uploaded_assets/ > /dev/null 2>&1 || true

echo "✅ Deployment complete!"
echo "🔗 Access your site (Insecure): http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "🔐 Access your site (Secure): http://$BUCKET_NAME.s3.$REGION.amazonaws.com/index.html"
