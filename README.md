## HRMS Demo

Monorepo with two Next.js applications:

- `frontend` (port `3000`)
- `backend` (port `3001`)

## Local development

Install dependencies:

```bash
npm ci
```

Run both apps:

```bash
npm run dev
```

## Production deployment on AWS EC2 (Docker)

This repository includes production Docker assets for EC2 deployment:

- `frontend/Dockerfile`
- `backend/Dockerfile`
- `docker-compose.prod.yml`
- `nginx/nginx.conf`
- `deploy/ec2-deploy.sh`
- `docker/.env.prod.example`

### 1) Provision AWS infrastructure

1. Create an EC2 instance (Ubuntu 22.04 recommended).
2. Create an RDS PostgreSQL instance in the same VPC.
3. Create an S3 bucket for documents.
4. Configure security groups:
   - EC2 inbound: `22` (your IP), `80` (public), `443` (public).
   - RDS inbound: `5432` from EC2 security group only.

### 2) Install Docker on EC2

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and log in again after adding your user to the Docker group.

### 3) Prepare application on EC2

```bash
sudo mkdir -p /opt/hrms-demo
sudo chown -R "$USER":"$USER" /opt/hrms-demo
git clone <your-repo-url> /opt/hrms-demo
cd /opt/hrms-demo
cp docker/.env.prod.example docker/.env.prod
```

Update `docker/.env.prod` with production values:

- `DATABASE_URL` (RDS endpoint)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (for example `https://hrms.yourdomain.com`)
- `NEXT_PUBLIC_API_BASE_URL` (same domain)
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### 4) First deploy

```bash
cd /opt/hrms-demo
bash deploy/ec2-deploy.sh
```

This script:

- pulls latest code,
- builds Docker images,
- starts/restarts containers,
- runs `prisma migrate deploy` in backend container.

### 5) Configure domain and TLS

Point your domain DNS A record to EC2 public IP, then install Certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hrms.yourdomain.com
```

Set `NEXTAUTH_URL` and `NEXT_PUBLIC_API_BASE_URL` to HTTPS domain in `docker/.env.prod`, then redeploy:

```bash
cd /opt/hrms-demo
bash deploy/ec2-deploy.sh
```

## Operations runbook

### Check status

```bash
cd /opt/hrms-demo
docker compose --env-file docker/.env.prod -f docker-compose.prod.yml ps
docker compose --env-file docker/.env.prod -f docker-compose.prod.yml logs -f --tail=100
```

### Restart services

```bash
cd /opt/hrms-demo
docker compose --env-file docker/.env.prod -f docker-compose.prod.yml restart
```

### Rollback

```bash
cd /opt/hrms-demo
git log --oneline -n 10
git checkout <previous-stable-commit>
docker compose --env-file docker/.env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file docker/.env.prod -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
```

If rollback commit predates a migration, restore from RDS snapshot instead of rolling schema backwards in-place.

## Security notes

- Do not commit real credentials in `.env` files.
- Rotate any credentials that were previously exposed.
- Prefer IAM roles for EC2 instead of long-lived AWS access keys where possible.
