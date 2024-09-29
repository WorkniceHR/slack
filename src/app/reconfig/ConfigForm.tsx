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
  newStarterChannel: string | null;
};

const ConfigForm = ({
  channels,
  integrationId,
  personActivatedChannel,
  calendarUpdateChannel,
  newStarterChannel,
}: Props) => {
  return (
    <form action={saveSelectedChannel} className="Card">
      <table style={{ width: '100%', tableLayout: 'fixed' }}>
        <tr><th colSpan={2}><h1>Reconfigure Integration</h1></th></tr>
        <tr><td colSpan={2}><span style={{ fontWeight: 'bold' }}>Notifications</span>
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
          <td><label htmlFor="newStarterChannel">New Starter</label></td>
          <td>
            <select
              id="newStarterChannel"
              name="newStarterChannel"
              className="wn-input"
              defaultValue={newStarterChannel ?? ""}
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
          <td><label htmlFor="calendarUpdateChannel">Daily Calendar Updates</label></td>
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
        <tr><td colSpan={2}>
        <button type="submit" className="wn-button--primary">Save</button>
          </td>
          </tr>
      </table>
    </form>
  );
};

export default ConfigForm;
