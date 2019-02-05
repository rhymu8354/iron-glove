import React from "react";

class ShowKeys extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let report = "Keys: ";
        let first = true;
        Object.keys(this.props.keys).forEach(key => {
            if (this.props.keys[key]) {
                if (!first) {
                    report += ", ";
                }
                first = false;
                report += key;
            }
        });
        return report;
    }
};

export default ShowKeys;
