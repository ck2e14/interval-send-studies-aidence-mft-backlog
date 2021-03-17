import React, { useState, useEffect } from "react";
import SID_GEN from "./Components/SIDGenerator/SIDGenerator.js";
import FEEDBACK_BOX from "./Components/FeedbackBox/FeedbackBox";
import { ExportToCsv } from "export-to-csv";
import "./App.css";
import DEV_APP from "./App_DEV.js";
import ANALYTICS from "./Components/Analytics/Analytics.js";

// TODO: Need to automate this more - set up daily polling (setInterval to check day, if day has changed run the script?)
// to backlog namespace to identify studies that haven't already been sent. Scoop the accessions up, load them, send them.
// should be no input necessary after initial trigger.
function App() {
   const [sessionID, setSessionID] = useState(null);
   const [password, setPassword] = useState("12newpassword");
   const [email, setEmail] = useState("C.kennedy@cimar.co.uk");
   const [finishedFetch, setFinishedFetch] = useState(true);
   const [showPushOrAnalytics, setShowPushOrAnalytics] = useState(false);
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
   const STUDY_LIST = `study/list?sid=${sessionID}&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&page.rows=5000`;
   const STUDY_LIST_FILTERS = `&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&page.rows=500`;
   // const STUDY_LIST_HLH_BL = `study/list?sid=${sessionID}&filter.phi_namespace.equals=1b872501-fcdb-4338-bb5f-ed69417179ff&page.rows=3500`;
   const STUDY_GET = `study/get?sid=${sessionID}&uuid=`;
   const STUDY_AUDIT = `audit/object?sid=${sessionID}&uuid=`;
   const [batch, setBatch] = useState("");
   const [accessions, setAccessions] = useState([""]);
   const [t0sWithNoT1, setT0sWithNoT1] = useState([]);
   const [currentDay, setCurrentDay] = useState("");
   const [uuid_search, setUuid_search] = useState("");
   const [current_hour, setCurrentHour] = useState(0);
   const [started_sending, setStarted_sending] = useState(false);
   const [num_studies, setNum_studies] = useState(0)

   var date = new Date();
   var dateStr = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

   // ON PAGE LOAD, GET CURRENT DAY AND HOUR AND SAVE IT - NOT IN USE CURRENTLY
   useEffect(() => {
      var today = date.getDay();
      setCurrentDay(today);
      const current_hour = date.getHours();
      setCurrentHour(current_hour);
   }, []);

   // SCRIPT CONTROLLER - controls the two intervals: 1) Polling for studies 2) Sending study/pushes
   const script_controller = () => {
      const interval_poller = () => {
         setInterval(() => {
            check_for_new_studies();
         }, 3000);
         // set to 5 mins when live
      };
      interval_poller();
   };

   // MONITORS STUDYOBJECTS.
   // When studyObjects is populated this useEffect runs ONCE.
   // I.e. if studies, and not started sending, start sending
   useEffect(() => {
      if (studyObjects.length > 0 && !started_sending) {
         send_controller();
      }
   }, [studyObjects]);

   // POLLING METHOD, WILL GET FIRED AT INTERVALS
   const check_for_new_studies = async () => {
      const holding_pen = [];

      const new_sid = await fetch_session_ID();

      const raw_resp = await fetch(`${API_BASE_URL}study/list?sid=${new_sid.sid}${STUDY_LIST_FILTERS}`);

      const JSON_resp = await raw_resp.json();

      // Only return studies that have a value in 'Reporting Priority' (only backlog studies will have this populated)
      await JSON_resp.studies.map(study => {
         study.customfields.map(cf => {
            if (cf.name === "Reporting Priority" && cf.value) {
               return holding_pen.push(study);
            }
         });
      });

      create_study_objects_2(holding_pen);
      setFinishedFetch(true);
   };

   // NEWEST CREATE STUDY OBJ METHOD - GETS PASSED STUDIES, MANIPS THEM, THEN PUTS NEAT STUDY OBJECTS INTO STATE
   const create_study_objects_2 = studies => {
      let studyObjectsArray = [];

      studies.map(study => {
         studyObjectsArray.push({
            accession_number: study.accession_number,
            MRN: study.patientid,
            uuid: study.uuid,
            patient_name: study.patient_name,
            prior_or_primary:
               study.customfields[0].name === "Reporting Priority" &&
               study.customfields[0].value === "Reported"
                  ? "PRIOR"
                  : study.customfields[0].name === "Reporting Priority" &&
                    (study.customfields[0].value === "Unreported" ||
                       study.customfields[0].value === "Reported - HLH")
                  ? "PRIMARY"
                  : "CHECK CIMAR",
            // 'prior_or_primary'' logic depends on the first customfield always being Reporting Priority. There are no other CFs in the MFT account currently.
            // Also depends on all priors being auto marked 'Reported' in that customfield. Actually reported studies will say 'Reported - HLH' (as opposed to priors marked complete and reported upon harvest - gateway ingress)
            // TODO: Needs to be more robust - check for the actual Aidence send not just hardcoded [0] index. Some will have PACS sends as index 0.
            // sent_to_AIDENCE:
            //    study.study_push_status[0]?.status === "S"
            //       ? "SENT"
            //       : study.study_push_status[0]?.status === "I"
            //       ? "IN PROCESS"
            //       : "NO SEND STATUS",
            returned_from_AIDENCE: study.source_ae_title === "AIDENCE" ? true : false,
            shared_with_HLH: true,
            reported_by_HLH: study.attachment_count > 0 ? true : false,
            to_GE_PACS_send_status:
               study.attachment_count > 0
                  ? study.study_push_status[1]?.status
                  : "NO REPORT - PACS PUSH NOT TRIGGERED",
         });
      });

      setStudyObjects(studyObjectsArray);
   };

   let num_studies_in_queue = studyObjects.length
   // AT A GIVEN INTERVAL, FIRES THE 'SEND' METHOD BY PASSING IT A REFERENCE TO THE RIGHT INDEX OF STATE STUDYOBJECTS TO SEND (AND NEW SID)
   const send_controller = async () => {
      setStarted_sending(true);

      await send_study_push(sessionID, 0);

      let interval = (60 / numSendsPerHour) * 60000;

      let index_tracker = 1;
      // index_tracker = 1 Because index 0 gets sent straight away, before the setInterval runs

      const disperser = () => {
         setInterval(() => {

            // console.log(`current studyObjects length = ${num_studies_in_queue}`);
            fetch_session_ID().then(new_sid => {
               if (index_tracker === studyObjects.length) {
                  feedback.push("Sent all retrieved studies");
                  clearInterval(disperser);
                  setFinishedFetch(true);
                  // return
               } else {
                  send_study_push(new_sid.sid, index_tracker);
                  index_tracker++;
                  console.log(index_tracker);
               }
            });
         }, 1000);
      };
      // 516000 - ms value for '1 every 8.6 minutes for 7 every hour'
      // 360000 - ms value for '1 every 6 minutes for 10/hr rate'
      // 276000 - ms value for '1 every 4.6 minutes for 13 every hour
      disperser();
   };

   const send_study_push = async (new_sid, front_of_queue_index) => {
      console.log(`front of queue index: ${front_of_queue_index}`)
      console.log(`current studyObjects length = ${num_studies_in_queue}`);

      // dummy below
      let destinationID = `4dc7234c-7ddc-4b05-a923-c7d404cc863`;
      // let destinationID = `4dc7234c-7ddc-4b05-a923-c7d404cc8633`;
      let sentLog = [];
      let errorSendLog = [];
      if (front_of_queue_index === studyObjects.length) {
         feedback.push("No more studies to process");
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

   const get_MFT_studies = async () => {
      console.log("Fetching MFT backlog studies...");
      feedback.push(`${dateStr}: Fetching MFT backlog studies...`);
      return fetch(`${API_BASE_URL}${STUDY_LIST}`)
         .then(resp => resp.json())
         .then(studies => {
            setBacklogStudies(studies.studies);
            setFinishedFetch(true);
            console.log("fetched studies");
         });
   };

   const count_T0_only_patients = async () => {
      // For each T0 studyObject's MRN  do a study/list call to the MFT backlog worklist
      studyObjects.map(T0_study => {
         let holding_pen = [];
         fetch(
            `https://mft.cimar.co.uk/api/v3/study/list?sid=${sessionID}&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&filter.patientid.equals=${T0_study.MRN}&page.rows=100&sort_by=created-asc`
         )
            .then(resp => resp.json())
            .then(data => {
               console.log(data);
               if (data.studies.length === 1) {
                  // If you loaded a T0, and only one study gets returned from that MRN, you know there is no associated T1
                  holding_pen.push({
                     accession_number: T0_study.accession_number,
                     MRN: T0_study.patientid,
                     uuid: T0_study.uuid,
                     patient_name: T0_study.patient_name,
                     no_associated_t1: true,
                  });
               } else if (data.studies.length > 1) {
                  // If there are more than 1 studies for that MRN, check if any have attachments (reports). If any do, you know there's an associated T1
                  data.studies.map(study => {
                     if (study.attachment_count > 0) {
                        console.log(
                           `Found associated T1 (accession ${study.accession_number}) for T0 accession: ${T0_study.accession_number}`
                        );
                        T0_study.associated_t1 = true;
                     } else {
                        return;
                     }
                  });
               }
               setT0sWithNoT1(holding_pen);
            });
      });
   };

   const waitForMe = async milisec => {
      return new Promise(resolve => {
         setTimeout(() => {
            resolve("");
         }, milisec);
      });
   };

   const fetch_session_ID = async () => {
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

   const audit_controller = async () => {
      exportToCSV(studyObjects, "MFT _ AIDENCE _ HLH Status Breakdown");
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

   const handle_load_batch = () => {
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

   // DEV TESTING FNS
   // PULL A STUDY FROM STATE AND CONSOLE LOG IT
   const check_study_by_uuid = () => {
      studyObjects.map(study => {
         if (study.uuid === uuid_search) {
            console.log(study);
         }
      });
   };
   // USE TO TEST HOW SEND_CONTROLLER RESPONDS TO NEW STUDIES GETTING ADDED.
   // ANSWER: AS WANTED, SEND CONTROLLER IS ACKNOWLEDGING NEW STUDIES. UNLIKE CONVENTIONAL LOOP
   const test_add_to_studies = () => {
      studyObjects.push({ a: 1, b: 2 });
   };
   // return <DEV_APP />;
   // DEV TESTING FNS

   if (showPushOrAnalytics) {
      return (
         <div className='App'>
            <div className='intro'>
               <strong> HOW TO USE: </strong>
               <br />
               Load space-separated accessions, and click match. Wait a minute for the fetches to complete.{" "}
               <br /> <br />
               If you loaded T0s and want to see which patients don't have an associated T1, first click
               'Check how many patients...' button and then 'AUDIT'.
               <br /> <br /> If you loaded T1s and want a general progress report just click AUDIT.
            </div>
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
                  <div className='btn ' onClick={() => handle_load_batch()}>
                     {accessions.length > 0 ? "Load pasted batch" : null}
                  </div>
               ) : null}

               {accessions.length > 1 ? (
                  <div className='btn' onClick={() => get_MFT_studies()}>
                     match {accessions.length} accessions w/ studies
                  </div>
               ) : null}

               {studyObjects.length > 0 && (
                  <div className='btn' onClick={() => audit_controller()}>
                     AUDIT {studyObjects.length} STUDIES
                  </div>
               )}

               {studyObjects.length > 0 && (
                  <div className='btn' onClick={() => count_T0_only_patients()}>
                     **
                     <br />
                     CHECK HOW MANY PATIENTS HAD PRIORS BUT NO T1S
                     <br /> [ ONLY LOAD T0 ACC's ]<br />
                     **
                  </div>
               )}
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
            <div className='intro'>
               <strong> HOW TO USE: </strong>
               <br />
               Load space-separated accessions, and click match. Wait a minute for the fetches to complete.{" "}
               <br /> <br />
               Trigger the dripfeed to send 1 study to Aidence every 8.6 mins, i.e. 7 every hour. <br />
               Recommend having devtools (React + network&amp;console tabs)
            </div>
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
               <div className='btn' onClick={() => test_add_to_studies()}>
                  TEST CHANGING LENGTH OF STUDY OBJECTS
               </div>
               {studyObjects.length > 0 && (
                  <>
                     <div className='btn'>
                        <input
                           value={uuid_search}
                           onChange={e => setUuid_search(e.target.value)}
                           type='text'
                           className='uuid_search'
                        />
                     </div>
                     <div className='btn' onClick={() => check_study_by_uuid()}>
                        ^ Check study uuid in state ^
                     </div>
                  </>
               )}

               <div className='btn' onClick={() => script_controller()}>
                  START POLLING
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

// REDUNDANT FNS Not pushing to state then monitoring with useEffect, just passing return values between functions
// (ALLOWS THE AUTOMATION)
// useEffect(() => {
//    setTimeout(() => {
//       if (finishedFetch && backlogStudies.length > 0) {
//          // create_study_objects();
//       }
//    }, 5000);
// }, [backlogStudies]);

// ************************

// setInterval(() => {
//    studyObjects.push({ a: 1, b: 2 });
// }, 1500);

// const hourlyDayChecker = async () => {
//    // get new studies Y
//    // do they have a value in reporting priority? Y
//    // if yes then its for backlog.  Y
//    // has it been sent already? Y
//    // if both conditions are true then push the study into create_study_objects_2() Y
//    // need to test that it gets picked up properly (and properly processed by create study objects) IT DOES
//    // and queued even if the send controller function began when the new studies weren't inside.
//    const poller = setInterval(() => {
//       fetch_session_ID().then(new_sid => {
//          fetch(
//             `${API_BASE_URL}study/list?sid=${new_sid.sid}&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&page.rows=500`
//          )
//             .then(resp => resp.json())
//             .then(data => {
//                const new_study_holding_pen = [];

//                data.studies.map(study => {
//                   // console.log(study);
//                   study.customfields.map(customfield => {
//                      // Is it for backlog (only backlog studies populate this field)
//                      if (customfield.name === "Reporting Priority") {
//                         if (customfield.value.length > 0) {
//                            // Has it been sent already?
//                            if (
//                               study.study_push_status[0]?.destination_name !== "Aidence MFT VEYE" &&
//                               study.study_push_status[0]?.status === "S"
//                            ) {
//                               return new_study_holding_pen.push(study);
//                            }
//                         }
//                      }
//                   });
//                   create_study_objects_2(new_study_holding_pen);
//                   setBacklogStudies(new_study_holding_pen);
//                   setFinishedFetch(true);
//                });
//             });
//       });
//    });

//    setInterval(async () => {
//       var dayCheck = date.getDay();
//       if (dayCheck !== currentDay) {
//          // 1. Update the current day
//          // 2. Poll mft backlog phi_ for studies
//          // 3. Studies not yet sent to Aidence should get queued and then dripfed,
//          //    same as if manually loaded the accessions and clicked dripfeed.

//          setCurrentDay(dayCheck);
//       }
//    }, 360);
//    // 1hr interval in ms
// };

// ************************

// const create_study_objects = () => {
//    // console.log("Associating batch accessions with study IDs...");
//    // creates a new record for controlling later CSV exports. Treat the raw study/list objects as data pools to insert to these
//    feedback.push(`${dateStr}: Associating batch accessions with MFT studies...`);
//    if (finishedFetch) {
//       let studyObjectsArray = [];
//       accessions.map(accession => {
//          backlogStudies.map(study => {
//             if (
//                accession === study.accession_number &&
//                (study.customfields[0].value === "Unreported" || study.customfields[0].value === "Reported")
//             ) {
//                studyObjectsArray.push({
//                   accession_number: study.accession_number,
//                   MRN: study.patientid,
//                   uuid: study.uuid,
//                   patient_name: study.patient_name,
//                   sent_to_AIDENCE:
//                      study.study_push_status[0]?.status === "S"
//                         ? "SENT"
//                         : study.study_push_status[0]?.status === "I"
//                         ? "IN PROCESS"
//                         : "NO SEND STATUS",
//                   returned_from_AIDENCE: study.source_ae_title === "AIDENCE" ? true : false,
//                   shared_with_HLH: true,
//                   reported_by_HLH: study.attachment_count > 0 ? true : false,
//                   to_GE_PACS_send_status:
//                      study.attachment_count > 0 ? study.study_push_status[1]?.status : "NOT YET REPORTED",
//                });
//             }
//          });
//       });
//       setStudyObjects(studyObjectsArray);
//       feedback.push(`${dateStr}: Created study objects.`);
//    }
// };
// REDUNDANT JSX
{
   /* <div className='btn' onClick={() => test_add_to_studies()}>
               TEST CHANGING LENGTH OF STUDY OBJECTS
            </div> */
}
{
   /* <div className='btn'>
                  <input
                     onChange={event => setBatch(event.target.value)}
                     value={batch}
                     type='text'
                     className='input'
                     placeholder='PASTE ACCESSIONS'
                  />
               </div> */
}
{
   /* {batch.length > 0 ? (
                  <div className='btn ' onClick={() => handle_load_batch()}>
                     {accessions.length > 0 ? "Batch loaded. Load new?" : " Load batch"}
                  </div>
               ) : null}

               {accessions.length > 0 ? (
                  <div className='btn' onClick={() => get_MFT_studies()}>
                     match accessions w/ studies
                  </div>
               ) : null} */
}
{
   /* <div className='btn' onClick={() => send_controller()}>
                  Trigger 7/hour drip-feed
               </div> */
}
{
   /* <div className='btn' onClick={() => check_for_new_studies()}>
               Get studies and run script (DEV)
            </div> */
}
