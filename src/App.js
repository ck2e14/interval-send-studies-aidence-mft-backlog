import React, { useState, useEffect } from "react";
import SID_GEN from "./Components/SIDGenerator/SIDGenerator.js";
import FEEDBACK_BOX from "./Components/FeedbackBox/FeedbackBox";
import { ExportToCsv } from "export-to-csv";
import "./App.css";
import DEV_APP from "./App_DEV.js";
import ANALYTICS from "./Components/Analytics/Analytics.js";

// TODO: Make status report button and functionality, to produce CSV checking on the send status (study/get) of the sent batch

function App() {
   const [sessionID, setSessionID] = useState(null);
   const [password, setPassword] = useState("Checksum321");
   const [email, setEmail] = useState("C.kennedy@cimar.co.uk");
   const [finishedFetch, setFinishedFetch] = useState(true);
   const [showPushOrAnalytics, setShowPushOrAnalytics] = useState(true);
   const [backlogStudies, setBacklogStudies] = useState([]);
   const [feedback, setFeedback] = useState([]);
   const [studyObjects, setStudyObjects] = useState([]);
   const [destinationID, setDestinationID] = useState("");
   const [intervalValue, setIntervalValue] = useState("60");
   const [numSendsPerHour, setNumSendsPerHour] = useState(400);
   const [indexTracker, setIndexTracker] = useState(0);
   const [errorSends, setErrorSends] = useState([]);
   const [okSends, setOkSends] = useState([]);
   const [statusLog, setStatusLog] = useState([]);
   const CORS_PROXY_URL = `https://sleepy-fjord-70300.herokuapp.com/`;
   const API_BASE_URL = `https://cloud.cimar.co.uk/api/v3/`;
   const STUDY_LIST = `study/list?sid=${sessionID}&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&page.rows=150`;
   const STUDY_GET = `study/get?sid=${sessionID}&uuid=`;
   const STUDY_AUDIT = `audit/object?sid=${sessionID}&uuid=`;
   const [batch, setBatch] = useState(
      "RM2100039099 RM297813604 RM2100039853 RM299575345 RM297906071 RM2100039974 RM297536685 RM297813696 RM297407221 RM297212097 RM297575904 RM297833932 RM297461101 RM299300388 RM297267190 RM297676671 RM297422095 RM297256569 RM299079532 RM297241723 RM297226564"
   );
   const [accessions, setAccessions] = useState([""]);

   var date = new Date();
   var dateStr = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

   const get_MFT_studies = async () => {
      console.log("Fetching MFT backlog studies...");
      feedback.push(`${dateStr}: Fetching MFT backlog studies...`);
      return fetch(`${API_BASE_URL}${STUDY_LIST}`)
         .then(resp => resp.json())
         .then(studies => {
            setBacklogStudies(studies.studies);
            setFinishedFetch(true);
         });
   };

   // "   RM296921384 RM296890970 RM299848610 RM296645671 RM297062362 RM296787352 RM296645912 RM297995646 RM299589084 RM295993846 RM299300345 RM296126044 RM299451975 RM299588920 RM296921218 RM299303087 RM296920924 RM296921501 RM296755955 RM296740388 RM297064295 RM296808730 RM296969654 RM297928319 RM297062656 RM296890936 RM296740317 RM296740023 RM297064270 RM296921481 RM297995962 RM297064292 RM296890185 RM297062666 RM296769095 RM297064110 RM296920940 RM296767832 RM296725875 RM296891020 RM297064178 RM297064187 RM296725891 RM296890869 RM296972373 RM296969669 RM297064099"

   useEffect(() => {
      if (backlogStudies.length > 0) {
         create_study_objects();
      }
   }, [backlogStudies]);

   const create_study_objects = () => {
      // console.log("Associating batch accessions with study IDs...");
      // creates a new record for controlling later CSV exports. Treat the raw study/list objects as data pools to insert to these
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
                     processed_and_delivered_to_hlh: "UNCHECKED - run end audit",
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

   const fetchSessionID = async () => {
      setFinishedFetch(false);
      // setCurrentAccount({});
      const CORS_ANYWHERE_PREFIX = "https://sleepy-fjord-70300.herokuapp.com/";
      const options = {
         method: "POST",
         body: encodeURI(`login=${email}&password=${password}`),
         headers: {
            "Content-Type": "application/x-www-form-urlencoded",
         },
      };
      return fetch(`${CORS_ANYWHERE_PREFIX}https://cloud.cimar.co.uk/api/v3/session/login`, options)
         .then(resp => resp.json())
         .then(data => {
            return data;
         });
   };

   const check_end_to_end_is_finished_per_study = () => {
      studyObjects.map(study => {
         fetch(`${API_BASE_URL}${STUDY_AUDIT}${study.uuid}`)
            .then(resp => resp.json())
            .then(audit => {
               console.log(audit);
               audit.events.map(audit_event => {
                  if (
                     audit_event?.detail?.name === "Backlog: Trigger Aidence Analysis Email (Cimar Support)"
                  ) {
                     console.log(
                        `${study.accession_number} has been returned and routed from Aidence to HLH `
                     );
                     study.processed_and_delivered_to_hlh = "TRUE";
                  }
               });
            });
      });
   };

   // ***********************
   const send_controller = async () => {
      let interval = (60 / numSendsPerHour) * 60000;
      // index_tracker = 1 Because index 0 gets sent straight away, before the setInterval runs
      let index_tracker = 1;

      await send_study_push(sessionID, 0);

      const disperser = setInterval(() => {
         fetchSessionID().then(new_sid => {
            if (index_tracker === studyObjects.length - 1) {
               alert("Batch processed.");
               clearInterval(disperser);
               setFinishedFetch(true);
               return;
            }
            send_study_push(new_sid.sid, index_tracker);
            index_tracker++;
         });
      }, 516000);
      // 516000 - ms value for '1 every 8.6 minutes or 7 every hour'
   };

   const send_study_push = async (new_sid, front_of_queue_index) => {
      let destinationID = `4dc7234c-7ddc-4b05-a923-c7d404cc8633`;
      let sentLog = [];
      let errorSendLog = [];
      if (front_of_queue_index === studyObjects.length) {
         alert("No more accessions to process");
         return;
      }
      console.log(`SEND FN: Receiving: SID: ${new_sid} ---- Current index_tracker: ${front_of_queue_index}`);
      console.log(
         `Accession of study currently sending: ${studyObjects[front_of_queue_index].accession_number} (index: ${front_of_queue_index})`
      );

      fetch(
         `${API_BASE_URL}study/push?sid=${new_sid}&uuid=${studyObjects[front_of_queue_index].uuid}&destination_id=${destinationID}`
      )
         .then(resp => resp.json())
         .then(() => {
            sentLog.push(studyObjects[front_of_queue_index]);
            feedback.push(`SEND SUCCESS: ${studyObjects[front_of_queue_index].uuid}`);
         })
         .catch(() => {
            errorSendLog.push(studyObjects[front_of_queue_index]);
            feedback.push(`${dateStr}: SEND FAIL: ${studyObjects[front_of_queue_index].uuid}`);
            console.log(`fail for: ${studyObjects[front_of_queue_index].accession_number} at: ${dateStr}`);
         });
   };

   const audit_controller = async () => {
// take the audit functions and put them in the analytics component then adapt improve built out etc 

   };
   // ***********************

   const generate_status_report = () => {
      let holding_pen = [];
      // write a loop that goes through all the studyObjects state key and study/gets for their push statuses
      // push a new object with the values from the currently iterated studyObject, plus a key:value pair for send status, into status_log state
      if (studyObjects.length < 1) {
         feedback.push(`${dateStr}: FAIL: No accessions loaded - can't create status report`);
         alert("No study objects - cannot create report");
      } else {
         studyObjects.map(local_study => {
            fetch(`${API_BASE_URL}${STUDY_AUDIT}${local_study.uuid}`)
               .then(audit_response => audit_response.json())
               .then(study_audit => {
                  console.log(study_audit);
               });

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
                     processed_and_delivered_to_hlh: local_study.processed_and_delivered_to_hlh,
                  });
               });
         });
      }
      setStatusLog(holding_pen);
      console.log(holding_pen);
      setFinishedFetch(true);
      setTimeout(() => {
         holding_pen.length > 0 ? exportToCSV(holding_pen, "STATUS REPORT") : null;
      }, 6500);
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

   // return <DEV_APP />;

   if (showPushOrAnalytics) {
      return (
         <div className='App'>
            <div className='btn toggle_btn' onClick={() => setShowPushOrAnalytics(!showPushOrAnalytics)}>
               TOGGLE PUSH/ANALYTICS
            </div>
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

               <div className='btn' onClick={() => audit_controller()}>
                  AUDIT
               </div>
            </div>
            <img
               src='https://www.cimar.co.uk/wp-content/uploads/2017/07/Cimar_NoSL_colors_big.png'
               alt=''
               className='logo'
            />
         </div>
      );
   } else {
      return (
         <div className='App'>
            <div className='btn toggle_btn' onClick={() => setShowPushOrAnalytics(!showPushOrAnalytics)}>
               TOGGLE PUSH/ANALYTICS
            </div>
            <div className='warning'>
               DO NOT CLOSE THIS TAB, DO NOT CLOSE THE BROWSER, DO NOT TURN OFF THE MACHINE!
            </div>
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
                     match accessions w/ studies
                  </div>
               ) : null}

               {studyObjects.length > 0 ? (
                  <div className='btn' onClick={() => check_end_to_end_is_finished_per_study()}>
                     AUDIT END TO END{" "}
                  </div>
               ) : null}

               {studyObjects.length > 0 ? (
                  <div className='btn' onClick={() => generate_status_report()}>
                     STATUS REPORT ON BATCH
                  </div>
               ) : null}
               <div className='btn' onClick={() => audit_controller()}>
                  NEW AUDIT
               </div>

               {/* {studyObjects?.length > 0 ? (
                  <div className='send_btn_wrapper'>
                     <div className='btn smaller_btn'>
                        <input
                           type='number'
                           onChange={event => setNumSendsPerHour(event.target.value)}
                           placeholder='NUM SENDS PER HOUR'
                           className='input'
                        />
                     </div>
                  </div>
               ) : null} */}
               {/*             
               {intervalValue?.length > 0 ? (
                  <div className='btn cyanText' onClick={() => send_studyPush_calls()}>
                     Trigger 7 Pushes
                  </div>
               ) : null} */}

               <div className='btn' onClick={() => send_controller()}>
                  Trigger 7/hour drip-feed
               </div>
            </div>
            <img
               src='https://www.cimar.co.uk/wp-content/uploads/2017/07/Cimar_NoSL_colors_big.png'
               alt=''
               className='logo'
            />
         </div>
      );
   }
}

export default App;
