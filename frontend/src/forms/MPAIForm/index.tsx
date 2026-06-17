import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  FormComponent,
  FormData,
  ValidationErrors,
  FormEditProps,
  FormViewProps,
} from '../../types/form';

const FORM_CODE = 'MPAI';
const SHEET_BORDER = '1px solid #2b2b2b';
const SHEET_FILL = '#c7f1f2';
const SHEET_BG = '#ffffff';
const COMPACT_ROW_HEIGHT = 30;
const PRINT_SCALE = 0.94;
const SCREEN_VIEW_SCALE = 0.84;
const SHEET_WIDTH = 980;
const SECTION_GAP = 24;
const TOP_LEFT_SECTION_WIDTH = 540;
const TOP_RIGHT_SECTION_WIDTH = SHEET_WIDTH - TOP_LEFT_SECTION_WIDTH - SECTION_GAP;
const MAIN_SECTION_WIDTH = 700;
const SIDE_SECTION_WIDTH = SHEET_WIDTH - MAIN_SECTION_WIDTH - SECTION_GAP;
const DILUTION_SECTION_WIDTH = 480;
const SAMPLE_TABLE_COLUMNS = '195px 160px 90px 90px 165px 140px 140px';
const CELL_ERROR_BG = '#fff2f2';
const CELL_ERROR_BORDER = '#c65555';
const TOP_LEVEL_NUMERIC_FIELDS = new Set([
  'standard_potency',
  'standard_dilution_1_weight_mg',
  'standard_dilution_1_make_up_ml',
  'standard_dilution_2_aliquot_ml',
  'standard_dilution_2_make_up_ml',
  'standard_dilution_3_aliquot_ml',
  'standard_dilution_3_make_up_ml',
  'sample_dilution_weight_mg',
  'sample_dilution_make_up_ml',
  'sample_dilution_2_aliquot_ml',
  'sample_dilution_2_make_up_ml',
  'sample_dilution_3_aliquot_ml',
  'sample_dilution_3_make_up_ml',
  'reporting_decimals',
  'ai_potency_standard_percent',
  'sample_potency',
]);

type SampleRow = {
  name: string;
  weight_mg: string;
  injection_1: string;
  injection_2: string;
  average_area: string;
  ai_percent: string;
  concentration_mg_l: string;
};

type StandardInjectionRow = {
  injection: string;
  area_count: string;
};

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildSampleRow(index: number): SampleRow {
  return {
    name: `Sample ${index}`,
    weight_mg: '',
    injection_1: '',
    injection_2: '',
    average_area: '',
    ai_percent: '',
    concentration_mg_l: '',
  };
}

function buildStandardInjectionRow(index: number): StandardInjectionRow {
  return {
    injection: String(index),
    area_count: '',
  };
}

function initialData(): FormData {
  return {
    product_name: '',
    study_no: '',
    test: '',
    test_item_code: '',
    instrument_id: '',
    analysis_date: getCurrentDateString(),
    test_item_batch_no: '',
    standard_name: '',
    standard_batch_no: '',
    standard_potency: '100.00',
    standard_dilution_1_weight_mg: '',
    standard_dilution_1_make_up_ml: '',
    standard_dilution_2_aliquot_ml: '',
    standard_dilution_2_make_up_ml: '',
    standard_dilution_3_aliquot_ml: '',
    standard_dilution_3_make_up_ml: '',
    sample_label: 'Sample',
    sample_dilution_weight_mg: '',
    sample_dilution_make_up_ml: '100',
    sample_dilution_2_aliquot_ml: '',
    sample_dilution_2_make_up_ml: '',
    sample_dilution_3_aliquot_ml: '',
    sample_dilution_3_make_up_ml: '',
    reporting_decimals: '3',
    ai_potency_standard_percent: '100.00',
    sample_potency: '',
    standard_injections: [1, 2, 3].map(buildStandardInjectionRow),
    samples: [1, 2, 3, 4, 5, 6].map(buildSampleRow),
    summary_mean: '',
    summary_sd: '',
    summary_rsd: '',
    summary_horwitz_rsdr: '',
    summary_horwitz_value: '',
    ai_formula_display: '',
    calculated_by: '',
    checked_by: '',
  };
}

function validate(data: FormData): ValidationErrors {
  const errors: ValidationErrors = [];

  const requiredFields: Array<[string, string]> = [
    ['product_name', 'Name of Product is required.'],
    ['study_no', 'Study No. is required.'],
    ['test', 'Test is required.'],
    ['test_item_code', 'Test Item Code is required.'],
    ['instrument_id', 'Instrument ID is required.'],
    ['analysis_date', 'Analysis Date is required.'],
    ['test_item_batch_no', 'Test Item Batch no. is required.'],
    ['standard_name', 'Standard Name is required.'],
    ['standard_batch_no', 'Batch No. is required.'],
  ];

  requiredFields.forEach(([field, message]) => {
    const value = data[field];
    if (!value || String(value).trim() === '') {
      errors.push({ field, message });
    }
  });

  if (data.analysis_date) {
    if (!parseDateValue(data.analysis_date)) {
      errors.push({ field: 'analysis_date', message: 'Analysis Date must be a valid date.' });
    }
  }

  TOP_LEVEL_NUMERIC_FIELDS.forEach((field) => {
    const value = data[field];
    if (value === null || value === undefined || String(value).trim() === '') return;
    if (parseNumeric(value) === null) {
      errors.push({ field, message: 'Only numeric values are allowed in this cell.' });
    }
  });

  getStandardInjections(data).forEach((row, index) => {
    if (row.area_count && parseNumeric(row.area_count) === null) {
      errors.push({
        field: `standard_injections.${index}.area_count`,
        message: 'Area count must be numeric.',
      });
    }
  });

  getSamples(data).forEach((row, index) => {
    (['weight_mg', 'injection_1', 'injection_2'] as Array<keyof SampleRow>).forEach((field) => {
      const value = row[field];
      if (value && parseNumeric(value) === null) {
        errors.push({
          field: `samples.${index}.${field}`,
          message: 'Only numeric values are allowed in this cell.',
        });
      }
    });
  });

  return errors;
}

function getStandardInjections(data: FormData): StandardInjectionRow[] {
  return Array.isArray(data.standard_injections)
    ? (data.standard_injections as StandardInjectionRow[])
    : [1, 2, 3].map(buildStandardInjectionRow);
}

function getSamples(data: FormData): SampleRow[] {
  return Array.isArray(data.samples)
    ? (data.samples as SampleRow[])
    : [1, 2, 3, 4, 5, 6].map(buildSampleRow);
}

function displayValue(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const normalizedValue = String(value).trim();
  if (!normalizedValue) return null;

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsedIsoDate = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    return Number.isNaN(parsedIsoDate.getTime()) ? null : parsedIsoDate;
  }

  const dmyMatch = normalizedValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) {
    const parsedDmyDate = new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00`);
    return Number.isNaN(parsedDmyDate.getTime()) ? null : parsedDmyDate;
  }

  const parsedFallbackDate = new Date(normalizedValue);
  return Number.isNaN(parsedFallbackDate.getTime()) ? null : parsedFallbackDate;
}

function formatAverageValue(first: unknown, second: unknown): string {
  const firstValue = parseNumeric(first);
  const secondValue = parseNumeric(second);
  if (firstValue === null || secondValue === null) return '';
  return ((firstValue + secondValue) / 2).toFixed(3);
}

function formatMean(values: Array<unknown>): string {
  const numericValues = values
    .map(parseNumeric)
    .filter((value): value is number => value !== null);
  if (numericValues.length === 0) return '';
  const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  return mean.toFixed(3);
}

function isNumericInput(value: string) {
  return /^-?\d*(\.\d*)?$/.test(value);
}

function updateListItem<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}

const SheetInput = memo(function SheetInput({
  value,
  onChange,
  onBlur,
  align,
  hasError,
  inputMode,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  align: 'left' | 'center' | 'right';
  hasError: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: string;
}) {
  return (
    <TextField
      fullWidth
      variant="standard"
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      error={hasError}
      slotProps={{
        input: {
          disableUnderline: true,
          sx: {
            px: 1,
            py: 0.2,
            textAlign: align,
            fontSize: '0.9rem',
            fontFamily: '"Times New Roman", Georgia, serif',
            bgcolor: hasError ? CELL_ERROR_BG : 'transparent',
            boxShadow: hasError ? `inset 0 0 0 1px ${CELL_ERROR_BORDER}` : 'none',
            '& input': {
              textAlign: align,
              py: 0.6,
            },
            '@media print': {
              px: 0.5,
              py: 0,
              fontSize: '0.74rem',
              boxShadow: 'none',
              bgcolor: 'transparent',
              '& input': {
                py: 0.2,
              },
            },
          },
          inputMode,
        },
      }}
    />
  );
});

const CompactSheetInput = memo(function CompactSheetInput({
  value,
  onChange,
  onBlur,
  hasError,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hasError: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <TextField
      fullWidth
      variant="standard"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      slotProps={{
        input: {
          disableUnderline: true,
          sx: {
            px: 0.75,
            py: 0.1,
            textAlign: 'center',
            fontSize: '0.9rem',
            fontFamily: '"Times New Roman", Georgia, serif',
            bgcolor: hasError ? CELL_ERROR_BG : 'transparent',
            boxShadow: hasError ? `inset 0 0 0 1px ${CELL_ERROR_BORDER}` : 'none',
            '& input': { textAlign: 'center', py: 0.5 },
            '@media print': {
              px: 0.35,
              py: 0,
              fontSize: '0.72rem',
              boxShadow: 'none',
              bgcolor: 'transparent',
              '& input': { py: 0.15 },
            },
          },
          inputMode,
        },
      }}
    />
  );
});

function FormView({ data, printScale }: FormViewProps) {
  return <MPAISheet data={data} mode="view" printScale={printScale} />;
}

function FormEdit({ data, onChange, onLiveChange, errors, onBlur, touched }: FormEditProps) {
  const [draftData, setDraftData] = useState<FormData>(data);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftData(data);
  }, [data]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const syncParent = useCallback((nextData: FormData, immediate = false) => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    if (immediate) {
      onChange(nextData);
      return;
    }

    syncTimerRef.current = setTimeout(() => {
      onChange(nextData);
      syncTimerRef.current = null;
    }, 90);
  }, [onChange]);

  const updateDraftData = useCallback((updater: (current: FormData) => FormData, immediate = false) => {
    setDraftData((current) => {
      const nextData = updater(current);
      onLiveChange?.(nextData);
      syncParent(nextData, immediate);
      return nextData;
    });
  }, [onLiveChange, syncParent]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    if (TOP_LEVEL_NUMERIC_FIELDS.has(field) && !isNumericInput(value)) {
      return;
    }
    updateDraftData((current) => ({ ...current, [field]: value }));
  }, [updateDraftData]);

  const handleStandardInjectionChange = useCallback((index: number, field: keyof StandardInjectionRow, value: string) => {
    if (field === 'area_count' && !isNumericInput(value)) {
      return;
    }
    updateDraftData((currentData) => {
      const current = getStandardInjections(currentData);
      const next = updateListItem(current, index, { ...current[index], [field]: value });
      return { ...currentData, standard_injections: next };
    });
  }, [updateDraftData]);

  const handleSampleChange = useCallback((index: number, field: keyof SampleRow, value: string) => {
    if (['weight_mg', 'injection_1', 'injection_2'].includes(field) && !isNumericInput(value)) {
      return;
    }
    updateDraftData((currentData) => {
      const current = getSamples(currentData);
      const next = updateListItem(current, index, { ...current[index], [field]: value });
      return { ...currentData, samples: next };
    });
  }, [updateDraftData]);

  const getError = useCallback((field: string) => {
    if (!touched.has(field)) return undefined;
    return errors.find((error) => error.field === field)?.message;
  }, [errors, touched]);

  const handleFieldBlur = useCallback((field: string) => {
    syncParent(draftData, true);
    onBlur?.(field);
  }, [draftData, onBlur, syncParent]);

  return (
    <Stack spacing={2}>
      {errors.filter((error) => error.field === '_form').map((error, index) => (
        <Typography key={index} variant="body2" color="error">
          {error.message}
        </Typography>
      ))}
      <MPAISheet
        data={draftData}
        mode="edit"
        onFieldChange={handleFieldChange}
        onStandardInjectionChange={handleStandardInjectionChange}
        onSampleChange={handleSampleChange}
        onBlur={handleFieldBlur}
        getError={getError}
      />
    </Stack>
  );
}

type SheetMode = 'view' | 'edit';

interface MPAISheetProps {
  data: FormData;
  mode: SheetMode;
  printScale?: number;
  onFieldChange?: (field: string, value: string) => void;
  onStandardInjectionChange?: (index: number, field: keyof StandardInjectionRow, value: string) => void;
  onSampleChange?: (index: number, field: keyof SampleRow, value: string) => void;
  onBlur?: (field: string) => void;
  getError?: (field: string) => string | undefined;
}

function MPAISheet({
  data,
  mode,
  printScale,
  onFieldChange,
  onStandardInjectionChange,
  onSampleChange,
  onBlur,
  getError,
}: MPAISheetProps) {
  const resolvedPrintScale = printScale ?? PRINT_SCALE;
  const resolvedScreenScale = printScale === undefined ? SCREEN_VIEW_SCALE : 1;
  const standardInjections = getStandardInjections(data);
  const samples = getSamples(data);
  const isEdit = mode === 'edit';
  const standardInjectionMean = formatMean(standardInjections.map((row) => row.area_count));
  const sampleFieldErrors = useMemo(
    () => samples.map((_, index) => ({
      weight_mg: getError?.(`samples.${index}.weight_mg`),
      injection_1: getError?.(`samples.${index}.injection_1`),
      injection_2: getError?.(`samples.${index}.injection_2`),
    })),
    [getError, samples],
  );
  const standardInjectionErrors = useMemo(
    () => standardInjections.map((_, index) => getError?.(`standard_injections.${index}.area_count`)),
    [getError, standardInjections],
  );

  const renderField = (
    field: string,
    options?: {
      align?: 'left' | 'center' | 'right';
      type?: string;
      fill?: boolean;
      readOnly?: boolean;
      placeholder?: string;
    },
  ) => {
    const value = displayValue(data[field], '');
    const error = getError?.(field);
    const hasError = !!error;
    const align = options?.align || 'left';
    const fill = options?.fill ?? true;
    const readOnly = options?.readOnly ?? false;

    if (!isEdit || readOnly) {
      return (
        <Cell fill={fill} align={align}>
          <ValueText align={align} muted={!value}>
            {value || (options?.placeholder || '')}
          </ValueText>
        </Cell>
      );
    }

    return (
      <Cell fill={fill} noPadding>
        <SheetInput
          value={value}
          type={options?.type || 'text'}
          onChange={(nextValue) => onFieldChange?.(field, nextValue)}
          onBlur={() => onBlur?.(field)}
          align={align}
          hasError={hasError}
          inputMode={TOP_LEVEL_NUMERIC_FIELDS.has(field) ? 'decimal' : undefined}
        />
      </Cell>
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        overflowX: 'auto',
        p: { xs: 0.75, md: 1.25 },
        borderRadius: 2,
        bgcolor: '#fdfdfb',
        '@media print': {
          overflow: 'visible',
          p: 0,
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          bgcolor: '#fff',
        },
      }}
    >
      <Box
        sx={{
          width: `${SHEET_WIDTH * resolvedScreenScale}px`,
          mx: 'auto',
          overflow: 'visible',
          '@media print': {
            width: '100%',
          },
        }}
      >
        <Box
          sx={{
            minWidth: SHEET_WIDTH,
            maxWidth: SHEET_WIDTH,
            zoom: printScale === undefined ? resolvedScreenScale : 1,
            fontFamily: '"Times New Roman", Georgia, serif',
            color: '#111',
            '@media print': {
              minWidth: '100%',
              maxWidth: '100%',
              width: '100%',
              zoom: resolvedPrintScale,
            },
          }}
        >
          <SheetTitle />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `${TOP_LEFT_SECTION_WIDTH}px ${TOP_RIGHT_SECTION_WIDTH}px`,
              gap: `${SECTION_GAP}px`,
              alignItems: 'flex-start',
              width: SHEET_WIDTH,
              mt: 2,
              mb: 3,
            }}
          >
            <WorksheetBlock width={TOP_LEFT_SECTION_WIDTH}>
              <TableBox columns="160px 380px" rows={4}>
                <LabelCell>Name of Product</LabelCell>
                {renderField('product_name')}
                <LabelCell>Study No.</LabelCell>
                {renderField('study_no')}
                <LabelCell>Test</LabelCell>
                {renderField('test')}
                <LabelCell>Test Item Code</LabelCell>
                {renderField('test_item_code')}
              </TableBox>
            </WorksheetBlock>

            <WorksheetBlock width={TOP_RIGHT_SECTION_WIDTH}>
              <TableBox columns="160px 256px" rows={3}>
                <LabelCell>Instrument ID:</LabelCell>
                {renderField('instrument_id')}
                <LabelCell>Analysis Date</LabelCell>
                {renderField('analysis_date', { type: 'date' })}
                <LabelCell>Test Item Batch no.</LabelCell>
                {renderField('test_item_batch_no')}
              </TableBox>
            </WorksheetBlock>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `${MAIN_SECTION_WIDTH}px ${SIDE_SECTION_WIDTH}px`,
              gap: `${SECTION_GAP}px`,
              alignItems: 'start',
              width: SHEET_WIDTH,
              mb: 3,
            }}
          >
            <Stack spacing={2}>
              <TableBox columns="145px 335px 95px 125px" rows={3}>
                <LabelCell>Standard Name</LabelCell>
                <SpanCell columns={3}>{renderField('standard_name')}</SpanCell>
                <LabelCell>Batch No.</LabelCell>
                <SpanCell columns={3}>{renderField('standard_batch_no')}</SpanCell>
                <LabelCell>AI/Potency of Standard</LabelCell>
                {renderField('standard_potency', { align: 'center' })}
                <Cell align="center">
                  <ValueText align="center">%w/w</ValueText>
                </Cell>
                <Cell align="center">
                  <ValueText align="center">on as is basis</ValueText>
                </Cell>
              </TableBox>

              <WorksheetSection title="STANDARD-1 DILUTION" width={DILUTION_SECTION_WIDTH}>
                <TableBox columns="145px 95px 105px 135px" rows={3}>
                  {renderField('standard_dilution_1_weight_mg', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">mg</ValueText></Cell>
                  {renderField('standard_dilution_1_make_up_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml</ValueText></Cell>
                  {renderField('standard_dilution_2_aliquot_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml to</ValueText></Cell>
                  {renderField('standard_dilution_2_make_up_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml</ValueText></Cell>
                  {renderField('standard_dilution_3_aliquot_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml to</ValueText></Cell>
                  {renderField('standard_dilution_3_make_up_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml</ValueText></Cell>
                </TableBox>
              </WorksheetSection>

              <WorksheetSection title="SAMPLE DILUTION" width={DILUTION_SECTION_WIDTH}>
                <TableBox columns="145px 95px 105px 135px" rows={3}>
                  {renderField('sample_label', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">mg</ValueText></Cell>
                  {renderField('sample_dilution_make_up_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml</ValueText></Cell>
                  {renderField('sample_dilution_2_aliquot_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml to</ValueText></Cell>
                  {renderField('sample_dilution_2_make_up_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml</ValueText></Cell>
                  {renderField('sample_dilution_3_aliquot_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml to</ValueText></Cell>
                  {renderField('sample_dilution_3_make_up_ml', { align: 'center' })}
                  <Cell align="center"><ValueText align="center">ml</ValueText></Cell>
                </TableBox>
                <TableBox columns="145px 95px 105px 135px" rows={2} sx={{ borderTop: 'none' }}>
                  <SpanCell columns={2}>
                    <LabelCell>No. of decimal for Reporting:</LabelCell>
                  </SpanCell>
                  {renderField('reporting_decimals', { align: 'center' })}
                  <LabelCell align="center">Sample Potency</LabelCell>
                  <SpanCell columns={2}>
                    <LabelCell>AI/Potency of Standard (%w/w)</LabelCell>
                  </SpanCell>
                  {renderField('ai_potency_standard_percent', { align: 'center' })}
                  {renderField('sample_potency', { align: 'center', fill: false })}
                </TableBox>
              </WorksheetSection>
            </Stack>

            <Stack spacing={2} sx={{ width: 'fit-content' }}>
              <TableBox columns="110px 146px" rows={5}>
                <HeaderCell>#Injection</HeaderCell>
                <HeaderCell>Area counts (uV*sec)</HeaderCell>
                {standardInjections.map((row, index) => (
                  <StandardInjectionRowCells
                    key={row.injection || index}
                    index={index}
                    row={row}
                    isEdit={isEdit}
                    error={standardInjectionErrors[index]}
                    onChange={onStandardInjectionChange}
                    onBlur={onBlur}
                  />
                ))}
                <HeaderCell>Mean</HeaderCell>
                <Cell fill={false} align="center">
                  <ValueText align="center" muted={!standardInjectionMean}>{standardInjectionMean}</ValueText>
                </Cell>
              </TableBox>
            </Stack>
          </Box>

          <Box sx={{ mb: 3, width: SHEET_WIDTH }}>
            <TableBox columns={SAMPLE_TABLE_COLUMNS} rows={9}>
              <HeaderCell rowSpan={2}>Sample Name/ Preparation</HeaderCell>
              <HeaderCell rowSpan={2}>Weight of Sample (mg)</HeaderCell>
              <SpanCell columns={2}><HeaderCell>Area Counts</HeaderCell></SpanCell>
              <HeaderCell rowSpan={2}>Average area counts (uV*sec)</HeaderCell>
              <HeaderCell rowSpan={2}>AI (%)</HeaderCell>
              <HeaderCell rowSpan={2}>Spl Conc.(mg/L)</HeaderCell>
              <HeaderCell>Injection-1</HeaderCell>
              <HeaderCell>Injection-2</HeaderCell>
              {samples.map((sample, index) => (
                <SampleRowCells
                  key={sample.name || index}
                  index={index}
                  row={sample}
                  isEdit={isEdit}
                  errors={sampleFieldErrors[index]}
                  onChange={onSampleChange}
                  onBlur={onBlur}
                />
              ))}
              <SpanCell columns={4}><Cell /></SpanCell>
              <HeaderCell>Mean</HeaderCell>
              {renderField('summary_mean', { align: 'center', fill: false })}
              <Cell fill={false} />
              <SpanCell columns={4}><Cell /></SpanCell>
              <HeaderCell>SD</HeaderCell>
              {renderField('summary_sd', { align: 'center', fill: false })}
              <Cell fill={false} />
              <SpanCell columns={4}><Cell /></SpanCell>
              <HeaderCell>%RSD</HeaderCell>
              {renderField('summary_rsd', { align: 'center', fill: false })}
              <Cell fill={false} />
              <SpanCell columns={4}><Cell /></SpanCell>
              <HeaderCell>Horwitz equation(%RSDr)</HeaderCell>
              {renderField('summary_horwitz_rsdr', { align: 'center', fill: false })}
              <Cell fill={false} />
              <SpanCell columns={4}><Cell /></SpanCell>
              <HeaderCell>Horwitz Value(Hr)</HeaderCell>
              {renderField('summary_horwitz_value', { align: 'center', fill: false })}
              <Cell fill={false} />
            </TableBox>
          </Box>

          <TableBox columns="170px 810px" rows={1} sx={{ mb: 4, width: SHEET_WIDTH }}>
            <LabelCell align="center">AI (% w/w) =</LabelCell>
            {renderField('ai_formula_display', {
              fill: false,
              placeholder: 'Formula placeholder - to be configured',
            })}
          </TableBox>

          <Box sx={{ display: 'grid', gridTemplateColumns: '478px 478px', gap: `${SECTION_GAP}px`, width: SHEET_WIDTH }}>
            <TableBox columns="120px 358px" rows={1}>
              <LabelCell>Calculated by:</LabelCell>
              {renderField('calculated_by', {
                fill: false,
                readOnly: true,
                placeholder: 'Auto-filled by system',
              })}
            </TableBox>
            <TableBox columns="120px 358px" rows={1}>
              <LabelCell>Checked by:</LabelCell>
              {renderField('checked_by', {
                fill: false,
                readOnly: true,
                placeholder: 'Auto-filled by system',
              })}
            </TableBox>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

const StandardInjectionRowCells = memo(function StandardInjectionRowCells({
  index,
  row,
  isEdit,
  error,
  onChange,
  onBlur,
}: {
  index: number;
  row: StandardInjectionRow;
  isEdit: boolean;
  error?: string;
  onChange?: (index: number, field: keyof StandardInjectionRow, value: string) => void;
  onBlur?: (field: string) => void;
}) {
  return (
    <Fragment>
      <Cell fill={false} align="center">
        <ValueText align="center" muted={!row.injection}>{row.injection}</ValueText>
      </Cell>
      {!isEdit ? (
        <Cell fill align="center">
          <ValueText align="center" muted={!row.area_count}>{row.area_count}</ValueText>
        </Cell>
      ) : (
        <Cell fill noPadding>
          <CompactSheetInput
            value={row.area_count}
            onChange={(nextValue) => onChange?.(index, 'area_count', nextValue)}
            onBlur={() => onBlur?.(`standard_injections.${index}.area_count`)}
            hasError={!!error}
            inputMode="decimal"
          />
        </Cell>
      )}
    </Fragment>
  );
});

const SampleRowCells = memo(function SampleRowCells({
  index,
  row,
  isEdit,
  errors,
  onChange,
  onBlur,
}: {
  index: number;
  row: SampleRow;
  isEdit: boolean;
  errors?: {
    weight_mg?: string;
    injection_1?: string;
    injection_2?: string;
  };
  onChange?: (index: number, field: keyof SampleRow, value: string) => void;
  onBlur?: (field: string) => void;
}) {
  const averageArea = formatAverageValue(row.injection_1, row.injection_2);

  return (
    <Fragment>
      <Cell fill align="center">
        <ValueText align="center" muted={!row.name}>{row.name}</ValueText>
      </Cell>
      {!isEdit ? (
        <Cell fill align="center">
          <ValueText align="center" muted={!row.weight_mg}>{row.weight_mg}</ValueText>
        </Cell>
      ) : (
        <Cell fill noPadding>
          <CompactSheetInput
            value={row.weight_mg}
            onChange={(nextValue) => onChange?.(index, 'weight_mg', nextValue)}
            onBlur={() => onBlur?.(`samples.${index}.weight_mg`)}
            hasError={!!errors?.weight_mg}
            inputMode="decimal"
          />
        </Cell>
      )}
      {!isEdit ? (
        <Cell fill align="center">
          <ValueText align="center" muted={!row.injection_1}>{row.injection_1}</ValueText>
        </Cell>
      ) : (
        <Cell fill noPadding>
          <CompactSheetInput
            value={row.injection_1}
            onChange={(nextValue) => onChange?.(index, 'injection_1', nextValue)}
            onBlur={() => onBlur?.(`samples.${index}.injection_1`)}
            hasError={!!errors?.injection_1}
            inputMode="decimal"
          />
        </Cell>
      )}
      {!isEdit ? (
        <Cell fill align="center">
          <ValueText align="center" muted={!row.injection_2}>{row.injection_2}</ValueText>
        </Cell>
      ) : (
        <Cell fill noPadding>
          <CompactSheetInput
            value={row.injection_2}
            onChange={(nextValue) => onChange?.(index, 'injection_2', nextValue)}
            onBlur={() => onBlur?.(`samples.${index}.injection_2`)}
            hasError={!!errors?.injection_2}
            inputMode="decimal"
          />
        </Cell>
      )}
      <Cell fill={false} align="center">
        <ValueText align="center" muted={!averageArea}>{averageArea}</ValueText>
      </Cell>
      <Cell fill={false} align="center">
        <ValueText align="center" muted={!row.ai_percent}>{row.ai_percent}</ValueText>
      </Cell>
      <Cell fill={false} align="center">
        <ValueText align="center" muted={!row.concentration_mg_l}>{row.concentration_mg_l}</ValueText>
      </Cell>
    </Fragment>
  );
});

function SheetTitle() {
  return (
    <Box
      sx={{
        width: '100%',
        boxSizing: 'border-box',
        border: SHEET_BORDER,
        px: 2,
        py: 0.55,
        textAlign: 'center',
        bgcolor: SHEET_BG,
        '@media print': {
          px: 1.5,
          py: 0.35,
        },
      }}
    >
      <Typography sx={{ fontSize: '1.02rem', fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.15, '@media print': { fontSize: '0.88rem' } }}>
        CALCULATION SHEET FOR METHOD PRECISION
      </Typography>
    </Box>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        boxSizing: 'border-box',
        border: SHEET_BORDER,
        borderBottom: 'none',
        py: 0.35,
        textAlign: 'center',
        bgcolor: SHEET_BG,
        '@media print': {
          py: 0.22,
        },
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.1, '@media print': { fontSize: '0.78rem' } }}>{title}</Typography>
    </Box>
  );
}

function WorksheetSection({
  title,
  width,
  children,
}: {
  title: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ width, display: 'grid', gap: 0, boxSizing: 'border-box' }}>
      <SectionHeader title={title} />
      <Box sx={{ display: 'grid', gap: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

function WorksheetBlock({
  width,
  children,
  sx,
}: {
  width: number;
  children: React.ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box
      sx={{
        width,
        display: 'grid',
        gap: 0,
        boxSizing: 'border-box',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function TableBox({
  columns,
  children,
  sx,
}: {
  columns: string;
  rows: number;
  children: React.ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: columns,
        gridAutoRows: `minmax(${COMPACT_ROW_HEIGHT}px, auto)`,
        borderTop: SHEET_BORDER,
        borderLeft: SHEET_BORDER,
        width: '100%',
        boxSizing: 'border-box',
        '@media print': {
          gridAutoRows: 'minmax(24px, auto)',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function SpanCell({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <Box sx={{ gridColumn: `span ${columns}`, height: '100%' }}>
      {children}
    </Box>
  );
}

function Cell({
  children,
  fill = false,
  align = 'left',
  noPadding = false,
}: {
  children?: React.ReactNode;
  fill?: boolean;
  align?: 'left' | 'center' | 'right';
  noPadding?: boolean;
}) {
  return (
    <Box
      sx={{
        borderRight: SHEET_BORDER,
        borderBottom: SHEET_BORDER,
        bgcolor: fill ? SHEET_FILL : SHEET_BG,
        px: noPadding ? 0 : 0.75,
        py: noPadding ? 0 : 0.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        minHeight: COMPACT_ROW_HEIGHT,
        height: '100%',
        boxSizing: 'border-box',
        '@media print': {
          px: noPadding ? 0 : 0.45,
          py: noPadding ? 0 : 0.05,
          minHeight: 24,
        },
      }}
    >
      {children}
    </Box>
  );
}

function LabelCell({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <Cell align={align}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.1, '@media print': { fontSize: '0.74rem' } }}>{children}</Typography>
    </Cell>
  );
}

function HeaderCell({
  children,
  rowSpan,
}: {
  children: React.ReactNode;
  rowSpan?: number;
}) {
  return (
    <Box sx={{ gridRow: rowSpan ? `span ${rowSpan}` : undefined, height: '100%' }}>
      <Cell align="center">
        <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', textAlign: 'center', lineHeight: 1.1, '@media print': { fontSize: '0.72rem' } }}>{children}</Typography>
      </Cell>
    </Box>
  );
}

function ValueText({
  children,
  align,
  muted = false,
}: {
  children: React.ReactNode;
  align: 'left' | 'center' | 'right';
  muted?: boolean;
}) {
  return (
    <Typography
      sx={{
        width: '100%',
        textAlign: align,
        fontSize: '0.84rem',
        fontWeight: muted ? 400 : 600,
        color: muted ? 'text.disabled' : 'text.primary',
        '@media print': {
          fontSize: '0.7rem',
          lineHeight: 1.05,
        },
      }}
    >
      {children}
    </Typography>
  );
}

const MPAIForm: FormComponent = {
  formCode: FORM_CODE,
  metadata: {
    name: 'MPAI Form',
    description: 'Method precision calculation sheet with laboratory worksheet layout',
    icon: 'Science',
    instructions: {
      summary: 'Use this form to capture the method precision worksheet in a structured digital format. Formula-driven cells are being staged and will be finalized in a later pass.',
      sections: [
        {
          title: 'Current Scope',
          items: [
            'This version focuses on the exact worksheet structure and manual data-entry layout.',
            'Calculated formula outputs are placeholders for now and will be connected later.',
          ],
        },
        {
          title: 'What to Enter',
          items: [
            'Complete the header details, standard details, dilution details, injection data, and sample rows.',
            'Use the footer sign-off fields for the people who prepared and checked the worksheet.',
          ],
        },
        {
          title: 'Review Note',
          items: [
            'Some result cells are intentionally left manual or blank until the calculation logic is added.',
            'Do not treat placeholder summary cells as validated outputs yet.',
          ],
        },
      ],
    },
  },
  FormView,
  FormEdit,
  validate,
  initialData,
};

export default MPAIForm;
