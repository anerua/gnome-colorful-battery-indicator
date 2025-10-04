/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import UPowerGlib from 'gi://UPowerGlib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ColorfulBatteryIndicator extends Extension {

    // This extension uses the 'unlock-user' session mode.
    // This is to ensure the battery indicator remains the same in the lock screen

    _initTimeout = null;
    _setupDone = false;

    _powerProxyId = null;

    _origSysIndicator = null;

    _percentage = null;
    _charging = false;
    _full = false;
    
    enable() {
        this._setup();

        // During system startup, Main.panel.statusArea.quickSettings._system is undefined
        // So we add a timer to try to run _setup every second until _system is defined
        // and setup is complete.
        this._initTimeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            1,
            () => {
                if (!this._setupDone) {
                    this._setup();
                    return GLib.SOURCE_CONTINUE;
                } else {
                    GLib.Source.remove(this._initTimeout);
                    return GLib.SOURCE_REMOVE;
                }
            }
        );
    }

    disable() {
        this._getSystem((proxy, system) => {
            if (this._origSysIndicator) {
                system.replace_child(
                    system._indicator,
                    this._origSysIndicator
                );
            }
            if (this._powerProxyId) {
                proxy.disconnect(this._powerProxyId);
            }
        });
        
        if (this._initTimeout) {
            GLib.Source.remove(this._initTimeout);
            this._initTimeout = null;
        }
    }

    _getSystem(callback) {
        let system = Main.panel.statusArea.quickSettings._system;
        if (system && system._systemItem._powerToggle) {
            callback(system._systemItem._powerToggle._proxy, system)
        }
    }

    _setup() {
        if (!this._setupDone) {
            this._getSystem((proxy, system) => {
                const extensionObject = Extension.lookupByURL(import.meta.url);
                const path = extensionObject.path;
    
                let bat_icon = new St.Icon({
                    style_class: 'system-status-icon'
                });
                let bat_icon_name = 'battery-missing';
                bat_icon.gicon = Gio.icon_new_for_string(`${path}/icons/${bat_icon_name}.svg`);
    
                this._origSysIndicator = system._indicator;
    
                const _onPowerChanged = () => {
                    if (proxy.IsPresent) {
                        this._percentage = proxy.Percentage;
                        this._charging = proxy.State === UPowerGlib.DeviceState.CHARGING;
                        this._full = proxy.State === UPowerGlib.DeviceState.FULLY_CHARGED;
                    } else {
                        this._percentage = null;
                    }
                            
                    if (this._percentage && this._full) {
                        bat_icon_name = 'battery-full';
                    } else if (this._percentage) {
                        // Group battery percentage into equivalent decade and display corresponding icon
                        let perc_range = Math.floor(this._percentage / 10) * 10;
                        bat_icon_name = this._charging ? `battery-${perc_range}-charging` : `battery-${perc_range}`;
                    } else {
                        bat_icon_name = 'battery-missing';
                    }
                    bat_icon.gicon = Gio.icon_new_for_string(`${path}/icons/${bat_icon_name}.svg`);

                    system.replace_child(
                        system._indicator,
                        bat_icon
                    );
                };
    
                this._powerProxyId = proxy.connect(
                    'g-properties-changed',
                    _onPowerChanged.bind(this)
                );

                this._setupDone = true;
            });
        }
    }

}
    