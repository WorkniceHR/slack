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
      <table>
        <tr><th colspan="2"><h1>Reconfigure Integration</h1></th></tr>
        <tr><td colspan="2"><span style="font-weight: bold;">Notifications</span>
          <p>Choose the Slack channels where you would like to receive the following notifications:</p>  
        </td></tr>
        <input type="hidden" name="integrationId" value={integrationId} />
        <tr>
          <td><label htmlFor="personActivatedChannel">New Person Activated</label></td>
          <td>
          <select
          id="personActivatedChannel"
          name="personActivatedChannel"
          className="wn-input"
          defaultValue={personActivatedChannel ?? ""}
        >
          <option value="">None (do not send an alert)</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
          </td>
        </tr>
        <tr>
          <td><label htmlFor="calendarUpdateChannel">Calendar Update Channel</label></td>
        </tr>
        <tr>
          <td>
          <select
          id="calendarUpdateChannel"
          name="calendarUpdateChannel"
          className="wn-input"
          defaultValue={calendarUpdateChannel ?? ""}
        >
          <option value="">None (do not send an alert)</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
          </td>
        </tr>
        <tr><td colspan="2">
        <button type="submit" className="wn-button--primary">Save</button>
          </td>
          </tr>
      </table>
    </form>
  );
};

export default ConfigForm;
