import React from "react";
import "./PopUp.css";

const PopUp = props => {
   const { title, content1, content2, className } = props;

   return (
      <div className={`popup-wrapper fade-in ${className}`}>
         <div className='title'>{title}</div>
         <div className='content1'>{content1}</div>
         <div className='content2'>{content2}</div>
      </div>
   );
};

export default PopUp;
