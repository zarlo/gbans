import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import React from 'react';
import { FormikHandlers, FormikState } from 'formik/dist/types';
import * as yup from 'yup';
import { emptyOrNullString } from '../../util/types';

export const BanReasonFieldValidator = yup
    .number()
    .label('Select a reason')
    .required('reason is required');

export const baseMaps = [
    'pl_badwater',
    'cp_process_final',
    'workshop/2834196889'
];

export const mapValidator = yup
    .string()
    .test('checkMap', 'Invalid map selection', async (map, _) => {
        return !emptyOrNullString(map);
    })
    .label('Select a map to play')
    .required('map is required');

export const ServerSelectionField = ({
    formik
}: {
    formik: FormikState<{
        map: string;
    }> &
        FormikHandlers;
}) => {
    return (
        <FormControl fullWidth>
            <InputLabel id="map-selection-label">Map Selection</InputLabel>
            <Select<string>
                labelId="map-selection-label"
                id="map-selection"
                name={'map-selection'}
                value={formik.values.map}
                onChange={formik.handleChange}
                error={formik.touched.map && Boolean(formik.errors.map)}
            >
                {baseMaps.map((v) => (
                    <MenuItem key={`time-${v}`} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </Select>
            <FormHelperText>
                {formik.touched.map && formik.errors.map}
            </FormHelperText>
        </FormControl>
    );
};
