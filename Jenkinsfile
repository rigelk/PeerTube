#!groovy

// node {
//   checkout()
//   /* Requires the Docker Pipeline plugin to be installed */
//   // docker.image('postgres:9.4').withRun('-e POSTGRES_PASSWORD=mysecretpassword') { rdb ->
//   //   docker.image('redis').withRun('') { odb ->
//   //     docker.image('node:8').inside("-u root --link ${rdb.id}:db --link ${obd.id}:redis") {
//   //       checkout scm
//   //       sh 'yarn install'
//   //     }
//   //   }
//   // }
// }
//
// def checkout () {
//   stage('Checkout code'){
//     try {
//       context="continuous-integration/jenkins/"
//       context += isPRMergeBuild()?"pr-merge/checkout":"branch/checkout"
//       checkout scm
//       setBuildStatus ("${context}", 'Checking out completed', 'SUCCESS')
//     }
//     catch (exc) {
//       echo 'Something failed, I should sound the klaxons!'
//       throw
//     }
//   }
// }

/*
So the Pipeline doesn't support docker-compose directly, just ONE docker
container at a time.
*/

def COMPOSE_PROJECT_NAME = "peertube${currentBuild.number}"

pipeline {
  agent any
  environment {
    CI = 'true'
  }
  // parameters {
  //   string(defaultValue: "peertube-"+$RANDOM%4, description: '', name: 'COMPOSE_PROJECT_NAME')
  // }
  stages {
    stage('Compose') {
      steps {
        checkout scm
        sh "echo ${COMPOSE_PROJECT_NAME}"
        sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f support/docker/ci/docker-compose.yml up -d postgres redis"
      }
    }
    stage('Test') {
      agent {
        docker {
          image 'node:8-stretch'
          args "--link ${COMPOSE_PROJECT_NAME}_postgres_1:postgres --link ${COMPOSE_PROJECT_NAME}_redis_1:redis --network=${COMPOSE_PROJECT_NAME}_default"
        }
      }
      steps {
        sh 'printenv'
      }
    }
    // stage('Checkout') {
    //   steps {
    //     checkout scm
    //   }
    // }
    // stage('Dependencies') {
    //   steps {
    //     sh 'yarn install'
    //   }
    // }
    // stage('Test') {
    //   steps {
    //     sh 'npm run test -- "misc"'
    //   }
    //   steps {
    //     sh 'npm run test -- "api-fast"'
    //   }
    //   steps {
    //     sh 'npm run test -- "api-slow"'
    //   }
    //   steps {
    //     sh 'npm run test -- "cli"'
    //   }
    //   steps {
    //     sh 'npm run test -- "lint"'
    //   }
    // }
  }
  post {
    always {
      sh "docker network ls"
      sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f support/docker/ci/docker-compose.yml down -v || true"
    }
  }
}
