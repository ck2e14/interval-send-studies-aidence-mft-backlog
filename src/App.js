import React, { useState, useEffect } from "react";
import SID_GEN from "./Components/SIDGenerator/SIDGenerator.js";
import FEEDBACK_BOX from "./Components/FeedbackBox/FeedbackBox";
import { ExportToCsv } from "export-to-csv";
import "./App.css";

function App() {
   const [sessionID, setSessionID] = useState(null);
   const [password, setPassword] = useState("Checksum321");
   const [email, setEmail] = useState("C.kennedy@cimar.co.uk");
   const [finishedFetch, setFinishedFetch] = useState();
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
   const [batch, setBatch] = useState(
      "RM296659376 RM296921275 RM295208916 RM295204737 RM297062587 RM297813397 RM297922396 RM296645480"
   );
   const [studyObjects, setStudyObjects] = useState();
   const [destinationName, setDestinationName] = useState("0fb2c754-a6a1-43ba-8426-0244eb540cd3");
   const [destinationID, setDestinationID] = useState("");
   const [intervalValue, setIntervalValue] = useState("");

   const CORS_PROXY_URL = `https://sleepy-fjord-70300.herokuapp.com/`;

   const API_BASE_URL = `https://cloud.cimar.co.uk/api/v3/`;

   const STUDY_LIST_ENDPOINT = `study/list?sid=${sessionID}&filter.phi_namespace.equals=d1776f8b-bb20-407a-b08b-1a5b7d3278b1&page.rows=999999
   `;

   const DESTINATION_ADD_ENDPOINT = `destination/add?sid=${sessionID}&account_id=72ad8de3-a873-45ef-a107-d43c3f050369&node_id=1dc76b73-3810-4ffe-9c3e-b144b1fcf9a3&name=${destinationName}
   `;
   // for dev purposes - add a new destination for each test (can only run one test per destination id)

   const add_new_destination = () => {
      var randomWords = require("random-words");
      let name = randomWords();

      // console.log(`${API_BASE_URL}${DESTINATION_ADD_ENDPOINT}${name}`)
      fetch(`${API_BASE_URL}${DESTINATION_ADD_ENDPOINT}${destinationName}`);
   };

   const get_MFT_studies = () => {
      // console.log("Fetching MFT backlog studies...");
      feedback.push("Fetching MFT backlog studies...");
      return fetch(`${CORS_PROXY_URL}${API_BASE_URL}${STUDY_LIST_ENDPOINT}`)
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
      feedback.push("Associating batch accessions with study IDs...");
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
         feedback.push("Created study objects.");
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
      // Loop that sends studyObjects[i] and studyObjects[i+1] and increments by two, delaying the loop each time by a specified amount
      for (let i = 0; i < studyObjects.length; i += 2) {
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${studyObjects[i].uuid}&destination_id=49c5eaa5-d6da-4b2b-84a9-864f52e263b2`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i]);
            });
         fetch(
            `${API_BASE_URL}study/push?sid=${sessionID}&uuid=${
               studyObjects[i + 1].uuid
            }&destination_id=49c5eaa5-d6da-4b2b-84a9-864f52e263b2`
         )
            .then(resp => resp.json())
            .then(() => {
               sentLog.push(studyObjects[i + 1]);
            });
         await waitForMe(intervalValue);
      }
      console.log(sentLog);
      sentLog.length > 0 ? exportToCSV(sentLog, "SENT STUDIES LOG") : null;
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
      feedback.push("Loading the following accessions...");
      splitBatch.map(acc => feedback.push(acc));
      console.log(splitBatch);
      setAccessions(splitBatch);
   };

   return (
      <div className='App'>
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
               <div className='btn cyanText' onClick={() => handleLoadBatch()}>
                  Load batch
               </div>
            ) : null}
            {accessions.length > 0 ? (
               <div className='btn' onClick={() => get_MFT_studies()}>
                  Stage Sends
               </div>
            ) : null}

            {studyObjects?.length > 0 ? (
               <>
                  <div className='btn'>
                     <input
                        type='number'
                        onChange={event => setIntervalValue(event.target.value)}
                        placeholder='INTERVAL (ms)'
                        className='input'
                     />
                  </div>
                  <div className='btn' onClick={() => send_studyPush_calls()}>
                     Send pushes
                  </div>
               </>
            ) : null}
         </div>
         <img src="https://www.cimar.co.uk/wp-content/uploads/2017/07/Cimar_NoSL_colors_big.png" alt="" className="logo"/>
      </div>
   );
}

export default App;
