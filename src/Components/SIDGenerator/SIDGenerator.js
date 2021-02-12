import React, { useState, useEffect } from "react";
import "./SIDGenerator.css";

const SidGen = props => {
   // Setters are from App.js because App.js is the lowest common ancestor
   // to SidGen.js siblings components that need the SID
   const {
      setSessionID,
      sessionID,
      setStackChoice,
      stackChoice,
      setEmail,
      email,
      setPassword,
      password,
      setRenderAccountsList,
      setRenderLoginBox,
      setFinishedFetch,
      setCurrentAccount,
   } = props;

   const [SID, setSID] = useState("");
   // const [stackChoice, setStackChoice] = useState("cloud");
   // const [email, setEmail] = useState("c.kennedy@cimar.co.uk");
   // const [password, setPassword] = useState("Checksum4321");

   // Upon page load populate state with SID (passed down to here from fetchSessionID via App.js)
   useEffect(() => {
      // setSID(sessionID);
      if(sessionID && sessionID.length > 0) {
         session_refresher()
      }
   }, [SID]);


   const session_refresher = () => {
      if(SID.length > 0) {
         setInterval(() => {
            setFinishedFetch(false);
            const CORS_ANYWHERE_PREFIX = "https://sleepy-fjord-70300.herokuapp.com/";
            const options = {
               method: "POST",
               body: encodeURI(`login=${email}&password=${password}&validate_session=${sessionID}`),
               headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
               },
            };
            fetch(`${CORS_ANYWHERE_PREFIX}https://cloud.cimar.co.uk/api/v3/session/login`, options)
               .then(resp => resp.json())
               .then(data => {
                  console.log(`refreshed: ${data.sid}`);
                  setSessionID(data.sid);
                  setSID(data.sid)
                  setFinishedFetch(true);
                  setTimeout(() => {
                     if (data.sid) {
                        // setRenderLoginBox(false);
                     }
                     if (!data.sid) {
                        alert(`Please check your login credentials`);
                     }
                  }, 1500);
               });
         },15000);
      }
   }

   const fetchSessionID = () => {
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
      fetch(`${CORS_ANYWHERE_PREFIX}https://cloud.cimar.co.uk/api/v3/session/login`, options)
         .then(resp => resp.json())
         .then(data => {
            console.log(`${email}\n${data.sid}`);
            setSessionID(data.sid);
            setFinishedFetch(true);
            // setRenderAccountsList(true);
            setTimeout(() => {
               if (data.sid) {
                  // setRenderLoginBox(false);
               }
               if (!data.sid) {
                  alert(`Please check your login credentials`);
               }
            }, 1500);
         });
   };

   const cloudAccessChangeHandler = event => {
      setStackChoice(event.target.value);
   };

   return (
      <div className='sidGenWrapper slide-in-bottom '>
         <form action='submit' className='' onSubmit={() => fetchSessionID()}>
            <input
               type='text'
               className='credentialsInput'
               id='credentialsInput'
               placeholder='Email'
               onChange={e => setEmail(e.target.value)}
               value={email}
            />
            <input
               type='password'
               className='credentialsInput'
               placeholder='Password'
               id='credentialsInput'
               value={password}
               onChange={e => setPassword(e.target.value)}
               // onSubmit={fetchSessionID}
            />
         </form>
         {SID && (
            <div className='sessionIdDisplay'>
               <p>SID:{SID}</p>
            </div>
         )}
         <div className='optionsWrapper'>
            <select
               name='stackDropdown'
               id=''
               className='stackDropdown'
               onChange={e => cloudAccessChangeHandler(e)}
               value={stackChoice}>
               <option value='cloud' className='stackOption cloudStack'>
                  Cloud
               </option>
               <option value='access' className='stackOption accessStack'>
                  Access
               </option>
            </select>
            <div className='getSessionIdBtn' onClick={fetchSessionID}>
               {sessionID ? "Refresh" : "Sign In"}
            </div>
         </div>
      </div>
   );
};

export default SidGen;
