import React from "react";
import "./Result.css";

interface ResultProps {
  imageUrl: string;
}


export const Result: React.FC<ResultProps> = ({ imageUrl }) => {
  return (
    <div className="result-container">
      <h1>Screenshot Captured</h1>
      <div className="image-container">
       
        {imageUrl ? <img className="screenshot-image" src={imageUrl} alt="Screenshot" />  : <p>Loading...</p>}
      </div>
    </div>
  );
};
