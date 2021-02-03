import React, { useState, useEffect } from "react";
import SID_GEN from "./Components/SIDGenerator/SIDGenerator.js";
import FEEDBACK_BOX from "./Components/FeedbackBox/FeedbackBox";
import { ExportToCsv } from "export-to-csv";
import "./App.css";

// TODO: Make status report button and functionality, to produce CSV checking on the send status (study/get) of the sent batch

function App() {
   const [sessionID, setSessionID] = useState(null);
   const [password, setPassword] = useState("Checksum321");
   const [email, setEmail] = useState("C.kennedy@cimar.co.uk");
   const [finishedFetch, setFinishedFetch] = useState(true);
   const [backlogStudies, setBacklogStudies] = useState([]);
   const [feedback, setFeedback] = useState([]);
   const [accessions, setAccessions] = useState([
      // "RM296659376",
      // "RM296921275",
      // "RM295208916",
      // "RM295204737",
      // "RM297062587",
      // "RM297813397",
      // "RM297922396",
      // "RM296645480",
   ]);
   const [batch, setBatch] = useState(""
      // "RM296659376 RM296921275 RM295208916 RM295204737 RM297062587 RM297813397 RM297922396 RM296645480"
   );
   const [studyObjects, setStudyObjects] = useState([]);
   const [destinationName, setDestinationName] = useState("4dc7234c-7ddc-4b05-a923-c7d404cc8633");
   const [destinationID, setDestinationID] = useState("");
   const [intervalValue, setIntervalValue] = useState("");
   const [errorSends, setErrorSends] = useState([]);
   const [okSends, setOkSends] = useState([]);
   const [statusLog, setStatusLog] = useState([]);
   const CORS_PROXY_URL = `https://sleepy-fjord-70300.herokuapp.com/`;
   const API_BASE_URL = `https://cloud.cimar.co.uk/api/v3/`;
   const STUDY_LIST = `study/list?sid=${sessionID}&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&page.rows=9999`;
   const STUDY_GET = `study/get?sid=${sessionID}&uuid=`;
   const DESTINATION_ADD = `destination/add?sid=${sessionID}&account_id=72ad8de3-a873-45ef-a107-d43c3f050369&node_id=1dc76b73-3810-4ffe-9c3e-b144b1fcf9a3&name=${destinationName}
   `;
   // for dev purposes - add a new destination for each test (can only run one test per destination id)

   var date = new Date();
   var dateStr = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

   const add_new_destination = () => {
      var randomWords = require("random-words");
      let name = randomWords();

      // console.log(`${API_BASE_URL}${DESTINATION_ADD_ENDPOINT}${name}`)
      fetch(`${API_BASE_URL}${DESTINATION_ADD_ENDPOINT}${destinationName}`);
   };

   const get_MFT_studies = () => {
      // console.log("Fetching MFT backlog studies...");
      feedback.push(`${dateStr}: Fetching MFT backlog studies...`);
      return fetch(`${API_BASE_URL}${STUDY_LIST}`)
         .then(resp => resp.json())
         .then(studies => {
            let studyArray = [];
            setBacklogStudies(studies.studies);
            setFinishedFetch(true);
         });
   };

   useEffect(() => {
      if (backlogStudies.length > 0) {
         create_study_objects();
      }
   }, [backlogStudies]);

   const create_study_objects = () => {
      // console.log("Associating batch accessions with study IDs...");
      feedback.push(`${dateStr}: Associating batch accessions with MFT studies...`);
      if (finishedFetch) {
         let studyObjectsArray = [];
         accessions.map(accession => {
            backlogStudies.map(study => {
               if (accession === study.accession_number) {
                  studyObjectsArray.push({
                     accession_number: study.accession_number,
                     uuid: study.uuid,
                     patient_name: study.patient_name,
                  });
               }
            });
         });
         setStudyObjects(studyObjectsArray);
         feedback.push(`${dateStr}: Created study objects.`);
      }
   };

   const waitForMe = async milisec => {
      return new Promise(resolve => {
         setTimeout(() => {
            resolve("");
         }, milisec);
      });
   };

   const send_studyPush_calls = async () => {
      let sentLog = [];
      let errorSendLog = [];
      let destinationID = `4dc7234c-7ddc-4b05-a923-c7d404cc8633`;
      // let destinationID = `ed05f760-abe5-473a-872b-538e7d7cefd5`;
      // Loop that sends studyObjects[i] and studyObjects[i+1] and increments by two, delaying the loop each time by a specified amount
      for (let i = 0; i < studyObjects.length; i += 7) {
         
         // F1, index 0
         fetch(
            `${CORS_PROXY_URL}${API_BASE_URL}study/push?sid=${sessionID}&uuid=${studyObjects[i].uuid}&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i].uuid}`]);
               console.log(`fail for: ${studyObjects[i].accession_number} at: ${dateStr}`);
            });
         


         // F2, index i + 1
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 1].uuid
            }&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 1]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i + 1].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i + 1]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i + 1].uuid}`]);
               console.log(`fail for: ${studyObjects[i + 1].accession_number} at: ${dateStr}`);
            });



         // F3, index i + 2
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 2].uuid
            }&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 2]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i + 2].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i + 2]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i + 2].uuid}`]);
               console.log(`fail for: ${studyObjects[i + 2].accession_number} at: ${dateStr}`);
            });



         // F4, index 3
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 3].uuid
            }&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 3]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i + 3].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i + 3]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i + 3].uuid}`]);
               console.log(`fail for: ${studyObjects[i + 3].accession_number} at: ${dateStr}`);
            });



         // F5, index 4
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 4].uuid
            }&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 4]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i + 3].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i + 4]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i + 4].uuid}`]);
               console.log(`fail for: ${studyObjects[i + 4].accession_number} at: ${dateStr}`);
            });



         // F6, index 5
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 5].uuid
            }&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 5]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i + 5].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i + 5]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i + 5].uuid}`]);
               console.log(`fail for: ${studyObjects[i + 5].accession_number} at: ${dateStr}`);
            });

         // F7, index 6
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 6].uuid
            }&destination_id=${destinationID}`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 6]);
               feedback.push([`SEND SUCCESS: ${studyObjects[i + 6].uuid}`]);
            })
            .catch(() => {
               errorSendLog.push(studyObjects[i + 6]);
               feedback.push([`${dateStr}: SEND FAIL: ${studyObjects[i + 6].uuid}`]);
               console.log(`fail for: ${studyObjects[i + 6].accession_number} at: ${dateStr}`);
            });


         await waitForMe(intervalValue * 60000);
      }
      console.log(sentLog);
      setErrorSends(errorSendLog);
      setOkSends(sentLog);
      sentLog.length > 0
         ? exportToCSV(
              sentLog,
              "These studies had valid send requests queued by script., Please check against the status report, to verify receipt of studies"
           )
         : null;
      errorSendLog.length > 0
         ? exportToCSV(errorSendLog, "* * These studies had their send requests rejected * *")
         : null;
   };

   const generate_status_report = () => {
      let holding_pen = [];
      // write a loop that goes through all the studyObjects state key and study/gets for their push statuses
      // push a new object with the values from the currently iterated studyObject, plus a key:value pair for send status, into status_log state
      if (studyObjects.length < 1) {
         feedback.push(`${dateStr}: FAIL: No accessions loaded - can't create status report`);
         alert("No study objects - cannot create report");
      } else {
         studyObjects.map(local_study => {
            fetch(`${API_BASE_URL}${STUDY_GET}${local_study.uuid}`)
               .then(resp => resp.json())
               .then(api_study => {
                  console.log(api_study);
                  holding_pen.push({
                     accession_number: local_study.accession_number,
                     uuid: local_study.uuid,
                     patient_name: local_study.patient_name,
                     most_recent_push_status:
                        api_study.study_push_status[api_study.study_push_status.length - 1]?.status,
                     most_recent_push_destination_name:
                        api_study.study_push_status[api_study.study_push_status.length - 1]?.destination_name,
                     most_recent_push_status_destination_id:
                        api_study.study_push_status[api_study.study_push_status.length - 1]?.destination_uuid,
                     most_recent_push_image_count:
                        api_study.study_push_status[api_study.study_push_status.length - 1]?.image_count,
                  });
               });
         });
         // exportToCSV(holding_pen, "STATUS REPORT")
      }
      setStatusLog(holding_pen);
      console.log(holding_pen);
      setFinishedFetch(true);
      setTimeout(() => {
         holding_pen.length > 0 ? exportToCSV(holding_pen, "STATUS REPORT") : null;
      }, 1500);
   };

   const exportToCSV = (exportItems, exportTitle) => {
      const options = {
         fieldSeparator: ",",
         quoteStrings: '"',
         decimalSeparator: ".",
         showLabels: true,
         showTitle: true,
         title: exportTitle,
         useTextFile: false,
         useBom: true,
         useKeysAsHeaders: true,
         // headers: ['Column 1', 'Column 2', etc...] <-- Won't work with useKeysAsHeaders present!
      };
      const csvExporter = new ExportToCsv(options);
      csvExporter.generateCsv(exportItems);
   };

   const handleLoadBatch = () => {
      // RM296659376 RM296921275 RM295208916 RM295204737 RM297062587 RM297813397 RM297922396 RM296645480
      let splitBatch = batch.split(" ");
      // console.log("Loading the following accessions...");
      if (accessions.length > 0) {
         feedback.push(`${dateStr}: Clearing current batch...`);
      }
      feedback.push(`${dateStr}: Loading the following accessions...`);
      splitBatch.map(acc => feedback.push(acc));
      console.log(splitBatch);
      setAccessions(splitBatch);
   };

   return (
      <div className='App'>
         {!finishedFetch && (
            <div className='shader-layer'>
               {" "}
               <div className='lds-ring'>
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
               </div>
            </div>
         )}
         <div className='feedback_component_wrapper'>
            <FEEDBACK_BOX feedback={feedback} />
         </div>{" "}
         <SID_GEN
            sessionID={sessionID}
            setSessionID={setSessionID}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            setFinishedFetch={setFinishedFetch}
         />
         <div className='script'>
            {/* <div className='btn' onClick={() => add_new_destination()}>
               <strong>*DEV*</strong>
               <br />
               <br /> ADD DESTINATION
            </div> */}
            <div className='btn'>
               <input
                  onChange={event => setBatch(event.target.value)}
                  value={batch}
                  type='text'
                  className='input'
                  placeholder='PASTE ACCESSIONS'
               />
            </div>

            {batch.length > 0 ? (
               <div className='btn ' onClick={() => handleLoadBatch()}>
                  {accessions.length > 0 ? "Batch loaded. Load new?" : " Load batch"}
               </div>
            ) : null}

            {accessions.length > 0 ? (
               <div className='btn' onClick={() => get_MFT_studies()}>
                  Stage Sends
               </div>
            ) : null}

            {studyObjects.length > 0 ? (
               <div className='btn' onClick={() => generate_status_report()}>
                  STATUS REPORT ON BATCH
               </div>
            ) : null}

            {studyObjects?.length > 0 ? (
               <div className='send_btn_wrapper'>
                  <div className='btn smaller_btn'>
                     <input
                        type='number'
                        onChange={event => setIntervalValue(event.target.value)}
                        placeholder='INTERVAL (mins)'
                        className='input'
                     />
                  </div>
               </div>
            ) : null}

            {intervalValue?.length > 0 ? (
               <div className='btn cyanText' onClick={() => send_studyPush_calls()}>
                  Send 7 pushes per the interval
               </div>
            ) : null}
         </div>
         <img
            src='https://www.cimar.co.uk/wp-content/uploads/2017/07/Cimar_NoSL_colors_big.png'
            alt=''
            className='logo'
         />
      </div>
   );
}

export default App;
