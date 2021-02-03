import React from "react";
import "./FeedbackBox.css";

const FeedbackBox = props => {
   const { feedback } = props;

   const renderFeedbacks = () => {
      return feedback.map(f => {
         return (
            <>
               <li>{f}</li>
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
