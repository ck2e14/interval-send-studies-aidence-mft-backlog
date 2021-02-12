const API_BASE_URL = `https://cloud.cimar.co.uk/api/v3/`;
const CORS_ANYWHERE_PREFIX = "https://sleepy-fjord-70300.herokuapp.com/";
const NEW_SESSION = `https://cloud.cimar.co.uk/api/v3/session/login`;
const STUDY_LIST = `study/list?sid=`;
const STUDY_LIST_FILTER = `&filter.phi_namespace.equals=fe20dda8-d002-4a65-9e83-7395e9b655e8&page.rows=200`;
// const STUDY_GET = `study/get?sid=${sessionID}&uuid=`;
// const STUDY_AUDIT = `audit/object?sid=${sessionID}&uuid=`;

const get_MFT_studies = async sessionID => {
   const raw_response = await fetch(`${API_BASE_URL}${STUDY_LIST}${sessionID}${STUDY_LIST_FILTER}`);
   const js_response = await raw_response.json();
   return js_response.studies;
};

const get_session_id = async (email, password) => {
   const options = {
      method: "POST",
      body: encodeURI(`login=${email}&password=${password}`),
      headers: {
         "Content-Type": "application/x-www-form-urlencoded",
      },
   };
   const raw_response = await fetch(`${NEW_SESSION}`, options);
   const js_response = await raw_response.json();
   console.log(js_response)
   return await js_response.sid;
};

const waitForMe = async ms_interval => {
   return new Promise(resolve => {
      setTimeout(() => {
         resolve("");
      }, ms_interval);
   });
};

export default {
   get_MFT_studies,
   get_session_id,
   waitForMe,
};
