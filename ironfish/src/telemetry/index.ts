/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// WARNING: this file contains nodejs-specific functionality
// that will need to be ported to the browser.

import DisabledTelemetry from './DisabledTelemetry'
import NodeTelemetry from './NodeTelemetry'

export { NodeTelemetry, DisabledTelemetry }

export type Field = {
  name: string
  type: 'string' | 'boolean' | 'float' | 'integer'
  value: string | boolean | number
}

interface Tag {
  name: string
  value: string
}

/**
 * A specific datapoint being collected.
 */
export type Metric = {
  /**
   * The name of whatever is being measured.
   */
  name: string
  /**
   * The exact time at which the metric was recorded.
   * JS gives us millisecond accuracy here.
   * Defaults to new Date() if not specified
   */
  timestamp?: Date
  /**
   * Collection of string keys and values to help identify
   * this metric.
   *
   * Expected values will be something like: "clientid": "xxx"
   * or "software version": "xxx".
   */
  tags?: Tag[]
  /**
   * Array of measured values for this particular measurement.
   * There must be at least one field.
   * Each field has a name, type, and a single value.
   */
  fields: Field[]
}

/**
 * Tool for collecting metrics. Connects to a node and sets up
 * event listeners for all known metrics.
 */
export interface Telemetry {
  startCollecting(endpoint: string): { status: string; next: Telemetry }
  stopCollecting(): Promise<{
    next: Telemetry
    status: string
  }>
  submit(metric: Metric): void
  isEnabled(): boolean
}

// This can be changed to a switch for browser implementation
export const EnabledTelemetry = NodeTelemetry

let telemetry: Telemetry = new DisabledTelemetry()

// List of tags that get added to every metric.
let defaultTags: Tag[] = []

/**
 * Check if telemetry reporting is currently active
 */
export function isEnabled(): boolean {
  return telemetry.isEnabled()
}

/**
 * Set the telemetry used for collecting metrics.
 *
 * This is primarily exposed for unit testing and initialization.
 * Prefer the startCollecting and stopCollecting state managers
 * in the general case.
 */
export function setTelemetry(newTelemetry: Telemetry): void {
  telemetry = newTelemetry
}

/**
 * Instruct the current telemetry to start collecting data.
 *
 * Is a noop if it is already collecting.
 *
 * Returns a status message intended for be displayed to the user
 */
export function startCollecting(endpoint: string): string {
  const result = telemetry.startCollecting(endpoint)
  telemetry = result.next
  return result.status
}

/**
 * Instruct the current telemetry to stop collecting data.
 *
 * Is a noop if it is not collecting.
 *
 * Returns a status message intended for display to the user
 */
export async function stopCollecting(): Promise<string> {
  const result = await telemetry.stopCollecting()
  telemetry = result.next
  return result.status
}

/**
 * Set key-value tags that get attached to every
 * request.
 *
 * These will probably be set on node startup, and never
 * changed.
 *
 * They can be set before telemetry is enabled.
 */
export function setDefaultTags(tags: Tag[]): void {
  defaultTags = tags
}

/**
 * Submit a metric to the telemetry service.
 *
 * This can be called unconditionally; the currently enabled
 * telemetry will decide whether to discard it if telemetry
 * is disabled.
 */
export function submitMetric(metric: Metric): void {
  if (metric.fields.length === 0) {
    throw new Error('Metric must have at least one field')
  }

  let tags = defaultTags
  if (metric.tags) {
    tags = tags.concat(metric.tags)
  }

  const toSubmit = {
    ...metric,
    timestamp: metric.timestamp || new Date(),
    tags,
  }

  telemetry.submit(toSubmit)
}
