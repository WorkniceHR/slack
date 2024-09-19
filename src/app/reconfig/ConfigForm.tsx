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
  calendarUpdateChannel: string | null;
};

const ConfigForm = ({
  channels,
  integrationId,
  personActivatedChannel,
  calendarUpdateChannel,
}: Props) => {
  return (
    <form action={saveSelectedChannel} className="Card">
      <input type="hidden" name="integrationId" value={integrationId} />
      <div>
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
      </div>
      <div>
        <label htmlFor="calendarUpdateChannel">Calendar Update Channel</label>
        <select
          id="calendarUpdateChannel"
          name="calendarUpdateChannel"
          defaultValue={calendarUpdateChannel ?? ""}
        >
          <option value="">None (do not send an alert)</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button type="submit">Save</button>
      </div>
    </form>
  );
};

export default ConfigForm;
