"use client"; // Ensure this is a client-side component (runs on both the server and client)

import { saveSelectedChannel } from "./actions";

// Define Slack Channel type
type SlackChannel = {
  id: string;
  name: string;
};

type Props = {
  channels: SlackChannel[];
  integrationId: string;
  personActivatedChannel: string | null;
};

const ConfigForm = ({
  channels,
  integrationId,
  personActivatedChannel,
}: Props) => {
  return (
<form action={saveSelectedChannel}>
  <input type="hidden" name="integrationId" value={integrationId} />
  
  <label htmlFor="personActivatedChannel">New Person Activated</label>
  <select
    id="personActivatedChannel"
    name="personActivatedChannel"
    defaultValue={personActivatedChannel ?? ""}
  >
    <option value="">None (do not send an alert)</option>
    {channels.map((channel) => (
      <option key={channel.id} value={channel.id}>
        {channel.name}
      </option>
    ))}
  </select>
  
  <label htmlFor="personBirthdayChannel">Person Birthday Channel</label>
  <select
    id="personBirthdayChannel"
    name="personBirthdayChannel"
    defaultValue={personBirthdayChannel ?? ""}
  >
    <option value="">None (do not send an alert)</option>
    {channels.map((channel) => (
      <option key={channel.id} value={channel.id}>
        {channel.name}
      </option>
    ))}
  </select>
  
  <button type="submit">Save</button>
</form>

  );
};

export default ConfigForm;
