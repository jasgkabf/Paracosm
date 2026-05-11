import React from "react";
import { Box, Text } from "ink";

interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
  color?: string;
}

interface TableProps {
  columns: TableColumn[];
  data: Array<Record<string, unknown>>;
  showHeader?: boolean;
  showBorders?: boolean;
  maxWidth?: number;
}

function padString(str: string, width: number, align: "left" | "right" | "center" = "left"): string {
  if (str.length >= width) return str.slice(0, width - 1) + ".";
  const padding = width - str.length;

  if (align === "right") {
    return " ".repeat(padding) + str;
  }

  if (align === "center") {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + str + " ".repeat(rightPad);
  }

  return str + " ".repeat(padding);
}

function renderCell(
  value: unknown,
  column: TableColumn,
  isHeader: boolean
): React.ReactElement {
  const str = isHeader ? column.header : String(value ?? "");
  const width = column.width ?? Math.max(str.length + 2, 10);
  const align = column.align ?? "left";
  const padded = padString(str, width, align);

  if (isHeader) {
    return (
      <Text bold color="cyan">
        {padded}
      </Text>
    );
  }

  if (column.color) {
    return <Text color={column.color}>{padded}</Text>;
  }

  return <Text>{padded}</Text>;
}

export function Table({
  columns,
  data,
  showHeader = true,
  showBorders = true,
}: TableProps): React.ReactElement {
  const separator = showBorders
    ? columns
        .map((col) => "-".repeat(col.width ?? Math.max(col.header.length + 2, 10)))
        .join("-+-")
    : null;

  const rows: React.ReactElement[] = [];

  if (showHeader) {
    rows.push(
      <Box key="header">
        {columns.map((col, i) => (
          <React.Fragment key={col.key}>
            {i > 0 && <Text> | </Text>}
            {renderCell(undefined, col, true)}
          </React.Fragment>
        ))}
      </Box>
    );

    if (separator) {
      rows.push(
        <Text key="separator" dimColor>
          {separator}
        </Text>
      );
    }
  }

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    rows.push(
      <Box key={`row-${rowIndex}`}>
        {columns.map((col, colIndex) => (
          <React.Fragment key={col.key}>
            {colIndex > 0 && <Text dimColor> | </Text>}
            {renderCell(row[col.key], col, false)}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  if (data.length === 0) {
    rows.push(
      <Text key="empty" dimColor>
        No data
      </Text>
    );
  }

  return <Box flexDirection="column">{rows}</Box>;
}
