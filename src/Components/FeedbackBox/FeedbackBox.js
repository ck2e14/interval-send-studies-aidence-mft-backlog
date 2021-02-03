import React from "react";
import "./FeedbackBox.css";

const FeedbackBox = props => {
   const { feedback } = props;

   var date = new Date();
   var str = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();


   const renderFeedbacks = () => {
      return feedback.map(f => {
         if(f.includes("RM")) {
            return (
               <>
                  <div>{`${f}`}</div>
                  <br />
               </>
            );
         }
         return (
            <>
               <li>{`${str} ${f}`}</li>
               <br />
            </>
         );
      });
   };

   return (
      <div className='feedback_box_wrapper'>
         <p className='title'>LOG</p>
         <ul className=''>{renderFeedbacks()}</ul>
      </div>
   );
};

export default FeedbackBox;
