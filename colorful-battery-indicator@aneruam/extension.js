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
 * 
 * Based on Circular Battery Indicator by Yannick Tanner
 */

/* exported init */

const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const UPower = imports.gi.UPowerGlib;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const ColorfulBatteryIndicator = GObject.registerClass(
    class ColorfulBatteryIndicator extends GObject.Object {

        _percentage = null;
        _charging = false;
        _full = false;
        
        _indicator = null;
    
        _powerProxyId = null;
        
        get _power() {
            return Main.panel.statusArea.aggregateMenu._power;
        }
        
        _init() {
            this._origIndicator = this._power._indicator;
        }
        
        enable() {
            let bat_icon = new St.Icon({
                style_class: 'system-status-icon'
            });
            let bat_icon_name = 'battery-missing';
            bat_icon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/${bat_icon_name}.svg`);
            this._indicator = bat_icon;
    
            let that = this;
            let power = this._power;
    
            // gfx
            power.indicators.replace_child(this._origIndicator, this._indicator);
    
            // events
            let _onPowerChanged = function() {
                if (this._proxy.IsPresent) {
                    that._percentage = this._proxy.Percentage;
                    that._charging = this._proxy.State == UPower.DeviceState.CHARGING;
                    that._full = this._proxy.State == UPower.DeviceState.FULLY_CHARGED;
                } else {
                    that._percentage = null;
                }
    
                if (that._percentage && that._full){
                    bat_icon_name = 'battery-full';
                } else if (that._percentage) {
                    // Group battery percentage into equivalent decade and display corresponding icon
                    let perc_range = Math.floor(that._percentage / 10) * 10;
                    bat_icon_name = that._charging ? `battery-${perc_range}-charging` : `battery-${perc_range}`;
                } else {
                    bat_icon_name = 'battery-missing';
                }
                bat_icon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/${bat_icon_name}.svg`);
            }
    
            this._powerProxyId = power._proxy.connect('g-properties-changed', _onPowerChanged.bind(power));
            _onPowerChanged.call(power);
        }
    
        // This extension uses the 'unlock-user' session mode.
        // This is to ensure the battery indicator is remains the same in the lock screen
        disable() {
            this._power.indicators.replace_child(this._indicator, this._origIndicator);
            this._power._proxy.disconnect(this._powerProxyId);
            this._indicator = null;
        }

    }
    
);

function init() {
    return new ColorfulBatteryIndicator();
}
