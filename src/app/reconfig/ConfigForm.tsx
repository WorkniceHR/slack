"use client"; // Ensure this is a client-side component

import reconfigIntegration from "@/actions/reconfigIntegration";
import { useState } from "react";

type Props = {
  automaticMatching: boolean;
  sessionCode: string;
};

const ConfigForm = ({ automaticMatching, sessionCode }: Props) => {
  const [data, setData] = useState({ automaticMatching });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setFormErrors([]);

    try {
      const result = await reconfigIntegration({
        automaticMatching: data.automaticMatching,
        sessionCode,
      });

      if (result.success) {
        setStatus("success");
      } else {
        setFormErrors(result.errors || []);
        setStatus("error");
      }
    } catch (error) {
      setFormErrors(["An error occurred while submitting the form."]);
      setStatus("error");
    }
  };

  return (
    <div>
      <h2>Reconfigure integration</h2>
      <form onSubmit={handleSubmit}>
        {formErrors.length > 0 && (
          <ul>
            {formErrors.map((error, idx) => (
              <li key={idx} style={{ color: "red" }}>{error}</li>
            ))}
          </ul>
        )}
        <div>
          <label htmlFor="automaticMatching">
            <input
              type="checkbox"
              id="automaticMatching"
              checked={data.automaticMatching}
              onChange={(e) => setData({ automaticMatching: e.target.checked })}
            />
            Enable automatic matching
          </label>
        </div>
        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Saving..." : "Save"}
        </button>
      </form>
      {status === "success" && <p style={{ color: "green" }}>Configuration saved successfully!</p>}
    </div>
  );
};

export default ConfigForm;
