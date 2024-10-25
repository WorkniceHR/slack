"use client";

import { saveSelectedChannel } from "./actions";

type SlackChannel = {
  id: string;
  name: string;
};

type Props = {
  channels: SlackChannel[];
  personActivatedChannel: string | null;
  calendarUpdateChannel: string | null;
  newStarterChannel: string | null;
};

const ConfigForm = ({
  channels,
  personActivatedChannel,
  calendarUpdateChannel,
  newStarterChannel,
}: Props) => {
  return (
    <form action={saveSelectedChannel} className="Card">
      <input
        type="hidden"
        name="personActivatedChannel"
        value={personActivatedChannel ?? ""}
      />
      <table style={{ width: "100%", tableLayout: "fixed" }}>
        <tr>
          <th colSpan={2}>
            <h1>Config Slack integration for Worknice</h1>
          </th>
        </tr>
        <tr>
          <td colSpan={2}>
            <p>
              Choose the Slack channels where you would like to receive the
              following notifications:
            </p>
          </td>
        </tr>
        {/* <tr>
          <td>
            <label htmlFor="personActivatedChannel">New Person Activated</label>
          </td>
          <td>
            <select
              id="personActivatedChannel"
              name="personActivatedChannel"
              className="wn-input"
              defaultValue={personActivatedChannel ?? ""}
            >
              <option value="">Do not send</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </td>
        </tr> */}
        <tr>
          <td>
            <label htmlFor="newStarterChannel">New Starters</label>
          </td>
          <td>
            <select
              id="newStarterChannel"
              name="newStarterChannel"
              className="wn-input"
              defaultValue={newStarterChannel ?? ""}
            >
              <option value="">Do not send</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label htmlFor="calendarUpdateChannel">
              Daily Calendar Updates
            </label>
          </td>
          <td>
            <select
              id="calendarUpdateChannel"
              name="calendarUpdateChannel"
              className="wn-input"
              defaultValue={calendarUpdateChannel ?? ""}
            >
              <option value="">Do not send</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td colSpan={2}>
            <button type="submit" className="wn-button--primary">
              Save
            </button>
          </td>
        </tr>
      </table>
    </form>
  );
};

export default ConfigForm;
