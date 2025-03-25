# Amazon Connect Voice to Voice (V2V) Translation Setup Guide

## Table of Contents

- [Solution components](#solution-components)
- [Solution prerequisites](#solution-prerequisites)
- [Solution setup](#solution-setup)
- [Test Webapp locally](#test-webapp-locally)
- [Clean up](#clean-up)
- [Demo Webapp key components](#demo-webapp-key-components)

## Solution components

On a high-level, the solution consists of the following components, each contained in these folders:

- **webapp** - Demo Web Application
- **cdk-stacks** - AWS CDK stacks:
  - `cdk-backend-stack` with all the backend resources needed for the solution (Amazon Cognito, etc)
  - `cdk-front-end-stack` with front-end resources for hosting the webapp (Amazon S3, Amazon CloudFront distribution)

## Solution prerequisites

- AWS Account
- [AWS IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html) with Administrator permissions
- Amazon Connect instance
- [Node](https://nodejs.org/) (v20) and [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (v10) installed and configured on your computer
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) (v2) installed and configured on your computer
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (v2) installed and configured on your computer

## Solution setup

The below instructions show how to deploy the solution using AWS CDK CLI. If you are using a Windows device please use the [Git BASH](https://gitforwindows.org/) terminal and use alternative commands where highlighted.

These instructions assume you have completed all the prerequisites, and you have an existing Amazon Connect instance.

1. Clone the solution to your computer (using `git clone`)

2. Check AWS CLI

   - AWS CDK will use AWS CLI local credentials and region
   - check your AWS CLI configuration by running an AWS CLI command (e.g. `aws s3 ls`)
   - you can also use profiles (i.e. `export AWS_PROFILE=<<yourProfile>>`)
   - you can confirm the configured region with  
     `aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]'`

3. Install NPM packages

   - Open your Terminal and navigate to `connect-v2v-translation-with-cx-options/cdk-stacks`
   - Run `npm run install:all`
   - This script goes through all packages of the solution and installs necessary modules (webapp, cdk-stacks)

4. Configure CDK stacks

   - In your terminal, navigate to `connect-v2v-translation-with-cx-options/cdk-stacks`
   - To see the full instructions for the configuration script, run  
     `npm run configure:help`
   - For the purpose of this guide, start the configuration script in interactive mode which will guide you through each input one at a time.
     (Note, it is possible to configure it via single command, by directly providing parameters, as described in the script help instructions)

     `npm run configure`

   - When prompted, provide the following parameters:
     - `cognito-domain-prefix`: Amazon Cognito hosted UI domain prefix, where users will be redirected during the login process. The domain prefix has to be unique, between 1 and 63 characters long, contains no special characters, and no keywords: `aws`, `amazon`, or `cognito` (RegEx pattern: `^[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?$`). You could put your Amazon Connect Instance Alias to it, for example: connect-v2v-instance-alias
     - `cognito-callback-urls`: Please provide a callback URL for the Amazon Cognito authorization server to call after users are authenticated. For now, set it as `https://localhost:5173`, we will come back to it once our front-end is deployed.
     - `cognito-logout-urls`: Please provide a logout URL where user is to be redirected after logging out. For now, set it as `https://localhost:5173`, we will come back to it once our front-end is deployed.
     - `connect-instance-url`: Amazon Connect instance URL that solution will use. For example: `https://connect-instance-alias.my.connect.aws` (or `https://connect-instance-alias.awsapps.com`)
     - `connect-instance-region`: Amazon Connect instance Region that solution will use. For example: us-east-1
     - `transcribe-region`: Amazon Transcribe Region that solution will use. For example: us-east-1
     - `translate-region`: Amazon Translate Region that solution will use. For example: us-east-1
     - `translate-proxy-enabled`: When enabled, webapp requests to Amazon Translate are proxied through Amazon Cloudfront (recommended to avoid CORS)
     - `polly-region`: Amazon Polly Region that solution will use. For example: us-east-1
     - `polly-proxy-enabled`: When enabled, webapp requests to Amazon Polly are proxied through Amazon Cloudfront (recommended to avoid CORS)

5. Deploy CDK stacks

   - In your terminal, navigate to navigate to `connect-v2v-translation-with-cx-options/cdk-stacks`
   - Run the script: `npm run build:webapp` (remember to complete this step whenever you want to deploy new front end changes)
     - **On Windows devices use `npm run build:webapp:gitbash`**.
   - This script builds frontend applications (webapp)
   - If you have started with a new environment, please bootstrap CDK: `cdk bootstrap`
   - Run the script: `npm run cdk:deploy`
     - **On Windows devices use `npm run cdk:deploy:gitbash`**.
   - This script deploys CDK stacks
   - Wait for all resources to be provisioned before continuing to the next step
   - AWS CDK output will be provided in your Terminal. You should see the Amazon Cognito User Pool Id as `userPoolId` from your Backend stack,
     and Amazon CloudFront Distribution URL as `webAppURL` from your Frontend stack.
     **Save these values as you will be using them in the next few steps.**

6. Configure Amazon Connect Approved Origins

- Login into your AWS Console
- Navigate to Amazon Connect -> Your instance alias -> Approved origins
- Click **Add Domain**
- Enter the domain of your web application, in this case Amazon CloudFront Distribution URL. For instance: `https://aaaabbbbcccc.cloudfront.net`
- Click **Add Domain**

7. Create Cognito User

   - To create an Amazon Cognito user, you'll need Cognito User Pool Id (created in step 5 - check for the AWS CDK Output, or check it in your AWS Console > Cognito User Pools)
   - Create an Amazon Cognito user either user directly in the [Cognito Console](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-create-user-accounts.html#creating-a-new-user-using-the-users-tab) or by executing:
     `aws cognito-idp admin-create-user --region <<yourDesiredRegion>> --user-pool-id <<yourUserPoolId>>  --username <<yourEmailAddress>> --user-attributes "Name=name,Value=<<YourName>>" --desired-delivery-mediums EMAIL`
   - You will receive an email, with a temporary password, which you will need in step 7
     **You can repeat this step for each person you want to give access to either now or at a later date.**

8. Configure Cognito Callback and Logout URLs

   - In your terminal, navigate to `connect-v2v-translation-with-cx-options/cdk-stacks`
   - Start the configuration script in interactive mode  
     `npm run configure`
   - The script loads all the existing parameters, and prompts for new parameters to be provided
   - Accept all the existing parameters, but provide a new value for:
     - `cognito-callback-urls`: Domain of your web application, in this case Amazon CloudFront Distribution URL. For instance: `https://aaaabbbbcccc.cloudfront.net`
     - `cognito-logout-urls`: Domain of your web application, in this case Amazon CloudFront Distribution URL. For instance: `https://aaaabbbbcccc.cloudfront.net`
     - For the Demo / Development purposes, you can configure both the previously entered `https://localhost:5173` and Amazon CloudFront Distribution URL (comma separated)
   - The script stores the deployment parameters to AWS System Manager Parameter Store
   - While in `connect-v2v-translation-with-cx-options/cdk-stacks`, run the deploy script: `npm run cdk:deploy`
     - **On Windows devices use `npm run cdk:deploy:gitbash`**.
   - Wait for the CDK stacks to be updated

9. Test the solution
   - Open your browser and navigate to Amazon CloudFront Distribution URL (Output to the console and also available in the Outputs of the Frontend Cloudformation Stack)
   - On the Cognito Login screen, provide your email address and temporary password you received via email
   - If logging in the first time you will be prompted to reset your password.
   - If not already logged in Amazon Connect CCP, you will need to provide your Amazon Connect Agent username and password (For Demo purposes, Amazon Cognito and Amazon Connect are not integrated)
   - You should now see Amazon Connect CCP and Voice to Voice (V2V) controls
   - To proceed with the demo, please check the **Custom UI Demo Guide** section

## Test Webapp locally

To be able to make changes in the Webapp and test them locally, without re-deploying the Webapp to Amazon CloudFront, please follow these steps:

1. In your terminal, navigate to `connect-v2v-translation-with-cx-options/cdk-stacks`
2. Synchronise the Webapp config parameters: `npm run sync-config`
3. This script will download `frontend-config.js` to the `webapp` folder
4. In your terminal, navigate to `connect-v2v-translation-with-cx-options/webapp`
5. To start the Webapp: `npm run dev`
6. This script starts a local Vite server on port 5173
7. Open your browser and navigate to `https://localhost:5173`
8. You can make changes and customize Webapp files, with browser automatically reloading the Webapp
9. Please make sure you add `https://localhost:5173` as Amazon Connect Approved Origin (see Step 6 in **Solution setup** -> **Configure Amazon Connect Approved Origins**)
10. Once happy with the changes, navigate to `connect-v2v-translation-with-cx-options/cdk-stacks` and `npm run build:deploy:all` (On Windows devices use `npm run build:deploy:all:gitbash`)

## Clean up

To remove the solution from your account, please follow these steps:

1. Remove CDK Stacks

   - Run `cdk destroy --all`

2. Remove deployment parameters from AWS System Manager Parameter Store
   - Run `npm run configure:delete`

## Demo Webapp key components

- **Adapters** - allow communication with AWS Services, abstracting AWS SDK specifics from the application business logic:
  - **Transcribe Adapter** - allows Amazon Transcribe client to be reused across requests, and provides provides separate Amazon Transcribe clients for agent's and customer's audio transcription
  - **Polly Adapter** - allows Amazon Polly client to be reused across requests, and allows Amazon CloudFront to act as a reverse proxy for Amazon Polly
  - **Translate Adapter** - allows Amazon Translate client to be reused across requests and allows Amazon CloudFront to act as a reverse proxy for Amazon Translate
- **Managers** - abstracts audio streaming specifics from the application business logic:
  - **Audio Stream Manager** - allows simple management and mixing of different audio streams, such as file, mic, translated voice etc.
    - `ToCustomerAudioStreamManager` is attached to **To Customer** audio element and controls what customer hears
    - `ToAgentAudioStreamManager` is attached to **To Agent** audio element and controls what agent hears
  - **Session Track Manager** - abstracts Amazon Connect WebRTC Media Streaming management
    - uses Amazon Connect SoftphoneManager (from Amazon Connect Streams JS / Amazon Connect RTC JS)
    - to set/replace current audio track in the currently active WebRTC PeerConnection
