const portNumber = 8181;
const projectKey = 'TEST';
const testRunId = 1000;
const testId = 942;
const sessionId = '3706ef44-605c-4c53-8ac7-b4230e058f47';
const http = require('http');

const startServer = async () => {
  return new Promise((resolve) => {
    http
      .createServer((req, res) => {
        let responseCode;
        let responseBody = {};
        switch (req.url) {
          case '/api/iam/v1/auth/refresh':
            responseBody = {authToken:'eyJhbGciOiJIUzUxMiIsInppcCI6IkdaSVAifQ.H4sIAAAAAAAAAH2STW_CMAxA_0vORBpiQyI3pF04bJMYt2lCbuuWjDSJYhcNIf77HL5UEOOW2C8vjuOdoq5QRo3UQHWEyUOLsk1b8CkQOhckETG1lsgGT8p8qcI6Z31jQmp0dODJdLECRiHPqQjbFj3rFnkVqjtAQqhka6E1EK3msEbx_BfdyOIUt35jGTjXYip0yPcSPU8_fKkiJ_JrbxTH0OlwTOEHS-4hl8gtcfEmjCFxfl8Z2gh-q11oQk_xH3DHUAGtigBJugdliUQ6Jru5pWrrOBddSk2MOnaFs-UVYT1jk04deGBqrUPi4PEhRQzlmhOUqB0U6ASWwWj8FcQi0ql7fN8BIjyOlTl8tTS2Tkgr9X1p7vKoz8OUZ293js8qZYaiCy6P6_T1bfY--1zMp4uPudrL8dom4qU013planCEA8XowbPg0HGI1gXO_07izb8va_yNYh0_D8cvo8nTZP8HUZuHah0DAAA.TPST153MqdytC3o4U4Cr_VJTKuEQHxUVaV9nbBEvEf08odksD1c53FwYkgeuCAw38cwu6NB314gDO_yJn1Vg0g'};
            responseCode = 200;
            break;
          case `/api/reporting/v1/test-runs?projectKey=${projectKey}`:
            responseCode = 200;
            responseBody = {id:testRunId};
            break;
          case `/api/reporting/v1/test-runs/${testRunId}`:
            responseCode = 200;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/tests`:
            responseCode = 200;
            responseBody = {id:testId};
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`:
            responseCode = 200;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/test-sessions`:
            responseCode = 200;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/test-sessions/`:
            responseCode = 200;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/labels`:
            responseCode = 204;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/test-sessions/${sessionId}`:
            responseCode = 200;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/screenshots`:
            responseCode = 201;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/artifacts`:
            responseCode = 201;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/test-sessions/${sessionId}/artifacts`:
            responseCode = 201;
            break;  
          case `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/labels`:
            responseCode = 204;
            break;
          case `/api/reporting/v1/test-runs/${testRunId}/logs`:
            responseCode = 202;
            break;
          default:
            responseCode = 404;
        }
        res.writeHead(responseCode, {'Content-Type': 'application/json'});
        if (responseBody !== '') {
          res.write(JSON.stringify(responseBody));
        }
        res.end();
      })
      .listen(portNumber);
    resolve(portNumber);
  });
};

startServer().then(f => {
  console.log(f)
})